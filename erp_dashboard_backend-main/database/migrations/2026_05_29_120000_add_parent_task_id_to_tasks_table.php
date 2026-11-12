<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('tasks', 'parent_task_id')) {
            return;
        }

        Schema::table('tasks', static function (Blueprint $table): void {
            $table->uuid('parent_task_id')->nullable()->after('project_id');
            $table->foreign('parent_task_id')->references('id')->on('tasks')->nullOnDelete();
            $table->index(['project_id', 'parent_task_id']);
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('tasks', 'parent_task_id')) {
            return;
        }

        Schema::table('tasks', static function (Blueprint $table): void {
            $table->dropIndex('tasks_project_id_parent_task_id_index');
            $table->dropForeign(['parent_task_id']);
            $table->dropColumn('parent_task_id');
        });
    }
};
