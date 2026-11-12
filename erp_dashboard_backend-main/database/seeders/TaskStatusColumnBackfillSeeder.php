<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TaskStatusColumnBackfillSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('tasks')
            ->select(['id', 'project_id', 'status'])
            ->whereNull('task_status_column_id')
            ->orderBy('id')
            ->chunk(500, function ($tasks): void {
                $projectIds = collect($tasks)
                    ->pluck('project_id')
                    ->filter()
                    ->unique()
                    ->values()
                    ->all();

                if ($projectIds === []) {
                    return;
                }

                $columns = DB::table('task_status_columns')
                    ->select(['id', 'project_id', 'slug'])
                    ->whereIn('project_id', $projectIds)
                    ->whereIn('slug', ['todo', 'done'])
                    ->get()
                    ->keyBy(static fn (object $column): string => $column->project_id.'|'.$column->slug);

                $updatesByColumnId = [];

                foreach ($tasks as $task) {
                    $slug = strtoupper((string) $task->status) === 'DONE' ? 'done' : 'todo';
                    $column = $columns->get((string) $task->project_id.'|'.$slug);

                    if (! $column) {
                        continue;
                    }

                    $updatesByColumnId[(string) $column->id][] = (string) $task->id;
                }

                foreach ($updatesByColumnId as $columnId => $taskIds) {
                    DB::table('tasks')
                        ->whereIn('id', $taskIds)
                        ->update([
                            'task_status_column_id' => $columnId,
                        ]);
                }
            });
    }
}
