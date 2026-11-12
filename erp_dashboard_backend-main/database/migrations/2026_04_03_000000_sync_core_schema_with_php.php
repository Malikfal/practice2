<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('projects') && ! Schema::hasColumn('projects', 'status')) {
            Schema::table('projects', function (Blueprint $table): void {
                $table->string('status')->default('ACTIVE');
            });
        }

        if (Schema::hasTable('tasks') && Schema::hasColumn('tasks', 'user_id')) {
            Schema::table('tasks', function (Blueprint $table): void {
                if ($this->hasForeignKey('tasks', 'tasks_user_id_foreign')) {
                    $table->dropForeign(['user_id']);
                }

                if ($this->hasIndex('tasks', 'tasks_user_id_index')) {
                    $table->dropIndex(['user_id']);
                }

                $table->dropColumn('user_id');
            });
        }

        if (Schema::hasTable('work_segments') && ! Schema::hasColumn('work_segments', 'user_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->foreignUuid('user_id')->nullable()->after('task_id');
                $table->index('user_id', 'work_segments_user_id_index');
            });
        }

        if (! Schema::hasTable('task_users')) {
            Schema::create('task_users', function (Blueprint $table): void {
                $table->uuid('task_id');
                $table->uuid('user_id');
                $table->primary(['task_id', 'user_id']);
                $table->index('user_id', 'task_users_user_id_index');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('task_users')) {
            Schema::drop('task_users');
        }

        if (Schema::hasTable('work_segments') && Schema::hasColumn('work_segments', 'user_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                if ($this->hasIndex('work_segments', 'work_segments_user_id_index')) {
                    $table->dropIndex('work_segments_user_id_index');
                }

                if ($this->hasForeignKey('work_segments', 'work_segments_user_id_foreign')) {
                    $table->dropForeign(['user_id']);
                }

                $table->dropColumn('user_id');
            });
        }

        if (Schema::hasTable('tasks') && ! Schema::hasColumn('tasks', 'user_id')) {
            Schema::table('tasks', function (Blueprint $table): void {
                $table->foreignUuid('user_id')->constrained('users')->restrictOnDelete();
                $table->index('user_id');
            });
        }

        if (Schema::hasTable('projects') && Schema::hasColumn('projects', 'status')) {
            Schema::table('projects', function (Blueprint $table): void {
                $table->dropColumn('status');
            });
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

    private function hasIndex(string $table, string $index): bool
    {
        return DB::table('pg_indexes')
            ->where('tablename', $table)
            ->where('indexname', $index)
            ->exists();
    }
};
