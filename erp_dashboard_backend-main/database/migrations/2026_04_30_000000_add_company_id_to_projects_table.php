<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('projects', 'company_id')) {
            Schema::table('projects', function (Blueprint $table): void {
                $table->uuid('company_id')->nullable();
            });
        }

        DB::statement('CREATE INDEX IF NOT EXISTS projects_company_id_index ON projects (company_id)');

        DB::statement(<<<'SQL'
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'projects_company_id_foreign'
                      AND conrelid = 'projects'::regclass
                ) THEN
                    ALTER TABLE projects
                    ADD CONSTRAINT projects_company_id_foreign
                    FOREIGN KEY (company_id)
                    REFERENCES companies(id)
                    ON DELETE SET NULL;
                END IF;
            END
            $$;
        SQL);
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_company_id_foreign');
        DB::statement('DROP INDEX IF EXISTS projects_company_id_index');

        if (Schema::hasColumn('projects', 'company_id')) {
            Schema::table('projects', function (Blueprint $table): void {
                $table->dropColumn('company_id');
            });
        }
    }
};
