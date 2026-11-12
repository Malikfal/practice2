<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('work_segments') || ! Schema::hasColumn('work_segments', 'task_id')) {
            return;
        }

        Schema::table('work_segments', function (Blueprint $table): void {
            if ($this->hasForeignKey('work_segments', 'work_segments_task_id_foreign')) {
                $table->dropForeign(['task_id']);
            }
        });

        if ($this->columnIsNullable('work_segments', 'task_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->uuid('task_id')->nullable(false)->change();
            });
        }

        if (! $this->hasForeignKey('work_segments', 'work_segments_task_id_foreign')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->foreign('task_id')->references('id')->on('tasks')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('work_segments') || ! Schema::hasColumn('work_segments', 'task_id')) {
            return;
        }

        Schema::table('work_segments', function (Blueprint $table): void {
            if ($this->hasForeignKey('work_segments', 'work_segments_task_id_foreign')) {
                $table->dropForeign(['task_id']);
            }
        });

        if (! $this->columnIsNullable('work_segments', 'task_id')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->uuid('task_id')->nullable()->change();
            });
        }

        if (! $this->hasForeignKey('work_segments', 'work_segments_task_id_foreign')) {
            Schema::table('work_segments', function (Blueprint $table): void {
                $table->foreign('task_id')->references('id')->on('tasks')->nullOnDelete();
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

    private function columnIsNullable(string $table, string $column): bool
    {
        return DB::table('information_schema.columns')
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->value('is_nullable') === 'YES';
    }
};
