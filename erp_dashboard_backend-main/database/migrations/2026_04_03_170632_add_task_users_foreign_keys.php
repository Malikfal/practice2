<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('task_users')) {
            return;
        }

        Schema::table('task_users', function (Blueprint $table): void {
            if (! $this->hasForeignKey('task_users', 'task_users_user_id_foreign')) {
                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            }

            if (! $this->hasForeignKey('task_users', 'task_users_task_id_foreign')) {
                $table->foreign('task_id')->references('id')->on('tasks')->cascadeOnDelete();
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('task_users')) {
            return;
        }

        Schema::table('task_users', function (Blueprint $table): void {
            if ($this->hasForeignKey('task_users', 'task_users_user_id_foreign')) {
                $table->dropForeign(['user_id']);
            }

            if ($this->hasForeignKey('task_users', 'task_users_task_id_foreign')) {
                $table->dropForeign(['task_id']);
            }
        });
    }

    private function hasForeignKey(string $table, string $constraint): bool
    {
        return DB::table('information_schema.table_constraints')
            ->where('table_name', $table)
            ->where('constraint_name', $constraint)
            ->where('constraint_type', 'FOREIGN KEY')
            ->exists();
    }
};
