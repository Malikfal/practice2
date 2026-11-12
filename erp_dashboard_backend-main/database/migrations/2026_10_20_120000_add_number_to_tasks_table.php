<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Постоянный номер задачи внутри проекта (#123 на карточке). Раньше фронт считал его
        // по порядку updated_at, и номера сдвигались после любой правки задачи.
        Schema::table('projects', function (Blueprint $table): void {
            $table->unsignedInteger('last_task_number')->default(0);
        });

        Schema::table('tasks', function (Blueprint $table): void {
            $table->unsignedInteger('number')->nullable();
        });

        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement(<<<'SQL'
            UPDATE tasks
            SET number = numbered.rn
            FROM (
                SELECT id, ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY created_at, id) AS rn
                FROM tasks
            ) AS numbered
            WHERE tasks.id = numbered.id
        SQL);

        DB::statement(<<<'SQL'
            UPDATE projects
            SET last_task_number = COALESCE((SELECT MAX(number) FROM tasks WHERE tasks.project_id = projects.id), 0)
        SQL);

        DB::statement('ALTER TABLE tasks ALTER COLUMN number SET NOT NULL');
        DB::statement('CREATE UNIQUE INDEX tasks_project_id_number_unique ON tasks (project_id, number)');

        // Номер выдаёт БД: задачи создают и Laravel, и Node API приложения (Prisma).
        // UPDATE строки проекта блокирует её до конца транзакции, поэтому параллельные
        // вставки в один проект получают разные номера.
        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION tasks_assign_number() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE' THEN
                    IF NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
                        RETURN NEW;
                    END IF;
                    NEW.number := NULL;
                END IF;

                IF NEW.number IS NULL THEN
                    UPDATE projects
                    SET last_task_number = last_task_number + 1
                    WHERE id = NEW.project_id
                    RETURNING last_task_number INTO NEW.number;
                END IF;

                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER tasks_assign_number
            BEFORE INSERT OR UPDATE OF project_id ON tasks
            FOR EACH ROW EXECUTE FUNCTION tasks_assign_number();
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::unprepared('DROP TRIGGER IF EXISTS tasks_assign_number ON tasks');
            DB::unprepared('DROP FUNCTION IF EXISTS tasks_assign_number()');
            DB::statement('DROP INDEX IF EXISTS tasks_project_id_number_unique');
        }

        Schema::table('tasks', function (Blueprint $table): void {
            $table->dropColumn('number');
        });

        Schema::table('projects', function (Blueprint $table): void {
            $table->dropColumn('last_task_number');
        });
    }
};
