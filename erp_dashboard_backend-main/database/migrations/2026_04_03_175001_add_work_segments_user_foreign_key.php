<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! $this->pgTypeExists('ProjectStatus')) {
            DB::statement('CREATE TYPE "ProjectStatus" AS ENUM (\'ACTIVE\', \'ARCHIVED\')');
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'status') && $this->columnType('projects', 'status') !== 'ProjectStatus') {
            DB::statement('ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT');
            DB::statement('ALTER TABLE "projects" ALTER COLUMN "status" TYPE "ProjectStatus" USING "status"::"ProjectStatus"');
            DB::statement('ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT \'ACTIVE\'');
        }

        if (! Schema::hasTable('work_segments') || ! Schema::hasColumn('work_segments', 'user_id')) {
            return;
        }

        if ($this->columnIsNullable('work_segments', 'user_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->uuid('user_id')->nullable(false)->change();
            });
        }

        if (! $this->hasForeignKey('work_segments', 'work_segments_user_id_foreign')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->foreign('user_id')->references('id')->on('users')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('work_segments') || ! Schema::hasColumn('work_segments', 'user_id')) {
            if ($this->pgTypeExists('ProjectStatus') && (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status') || $this->columnType('projects', 'status') !== 'ProjectStatus')) {
                DB::statement('DROP TYPE IF EXISTS "ProjectStatus"');
            }

            return;
        }

        if ($this->hasForeignKey('work_segments', 'work_segments_user_id_foreign')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->dropForeign(['user_id']);
            });
        }

        if (! $this->columnIsNullable('work_segments', 'user_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->uuid('user_id')->nullable()->change();
            });
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'status') && $this->columnType('projects', 'status') === 'ProjectStatus') {
            DB::statement('ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT');
            DB::statement('ALTER TABLE "projects" ALTER COLUMN "status" TYPE VARCHAR(255) USING "status"::text');
            DB::statement('ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT \'ACTIVE\'');
        }

        if ($this->pgTypeExists('ProjectStatus') && (! Schema::hasTable('projects') || ! Schema::hasColumn('projects', 'status') || $this->columnType('projects', 'status') !== 'ProjectStatus')) {
            DB::statement('DROP TYPE IF EXISTS "ProjectStatus"');
        }
    }

    private function hasForeignKey(string $table, string $constraint): bool
    {
        return DB::table('information_schema.table_constraints')
            ->where('table_name', $table)
            ->where('constraint_name', $constraint)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
    }

    private function columnIsNullable(string $table, string $column): bool
    {
        return DB::table('information_schema.columns')
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->value('is_nullable') === 'YES';
    }

    private function columnType(string $table, string $column): ?string
    {
        return DB::table('information_schema.columns')
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->value('udt_name');
    }

    private function pgTypeExists(string $type): bool
    {
        return DB::table('pg_type')->where('typname', $type)->exists();
    }
};
