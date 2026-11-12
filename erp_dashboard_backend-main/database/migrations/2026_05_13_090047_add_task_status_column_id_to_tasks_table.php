<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
           if (! Schema::hasColumn('tasks', 'task_status_column_id')) {
                $table->foreignUuid('task_status_column_id')
                    ->nullable()
                    ->after('project_id')
                    ->constrained('task_status_columns')
                    ->nullOnDelete();

                $table->index(['project_id', 'task_status_column_id']);
            }
        });

        $this->createDefaultColumnsForExistingProjects();
        $this->moveOldTaskStatusesToColumns();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            if (Schema::hasColumn('tasks', 'task_status_column_id')) {
                $table->dropForeign(['task_status_column_id']);
                $table->dropIndex(['project_id', 'task_status_column_id']);
                $table->dropColumn('task_status_column_id');
            }
        });
    }

    private function createDefaultColumnsForExistingProjects(): void
    {
        $defaults = [
            [
                'slug' => 'todo',
                'name' => 'Сделать',
                'color' => '#4db6f2',
                'position' => 1,
                'is_default' => true,
                'is_final' => false,
            ],
            [
                'slug' => 'in_progress',
                'name' => 'В работе',
                'color' => '#f29a3f',
                'position' => 2,
                'is_default' => false,
                'is_final' => false,
            ],
            [
                'slug' => 'review',
                'name' => 'На проверке',
                'color' => '#ef2d2d',
                'position' => 3,
                'is_default' => false,
                'is_final' => false,
            ],
            [
                'slug' => 'done',
                'name' => 'Завершено',
                'color' => '#60c94a',
                'position' => 4,
                'is_default' => false,
                'is_final' => true,
            ],
        ];

        DB::table('projects')
            ->select(['id', 'company_id'])
            ->orderBy('id')
            ->chunk(100, function ($projects) use ($defaults): void {
                foreach ($projects as $project) {
                    foreach ($defaults as $default) {
                        $exists = DB::table('task_status_columns')
                            ->where('project_id', $project->id)
                            ->where('slug', $default['slug'])
                            ->exists();

                        if ($exists) {
                            continue;
                        }

                        DB::table('task_status_columns')->insert([
                            'id' => (string) Str::uuid(),
                            'company_id' => $project->company_id,
                            'project_id' => $project->id,
                            'name' => $default['name'],
                            'slug' => $default['slug'],
                            'color' => $default['color'],
                            'position' => $default['position'],
                            'is_default' => $default['is_default'],
                            'is_final' => $default['is_final'],
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }
            });
    }

    private function moveOldTaskStatusesToColumns(): void
    {
        DB::table('tasks')
            ->select(['id', 'project_id', 'status'])
            ->whereNull('task_status_column_id')
            ->orderBy('id')
            ->chunk(100, function ($tasks): void {
                foreach ($tasks as $task) {
                    $slug = $task->status === 'DONE' ? 'done' : 'todo';

                    $columnId = DB::table('task_status_columns')
                        ->where('project_id', $task->project_id)
                        ->where('slug', $slug)
                        ->value('id');

                    if (! $columnId) {
                        continue;
                    }

                    DB::table('tasks')
                        ->where('id', $task->id)
                        ->update([
                            'task_status_column_id' => $columnId,
                            'updated_at' => now(),
                        ]);
                }
            });
    }


};
