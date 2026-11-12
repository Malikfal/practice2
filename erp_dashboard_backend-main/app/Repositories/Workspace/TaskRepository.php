<?php

namespace App\Repositories\Workspace;

use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Task;
use App\Models\TaskStatusColumn;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TaskRepository
{
    private const SEGMENT_DURATION_SQL = '(seg.ended_at - seg.started_at)';

    public function tasks(Project $project): Collection
    {
        return $this->baseTaskBoardQuery($project)
            ->where(function (Builder $query): void {
                $query
                    ->whereNull('tasks.parent_task_id')
                    ->orWhereNotExists(function ($parentQuery): void {
                        $parentQuery
                            ->selectRaw('1')
                            ->from('tasks as parent_tasks')
                            ->whereColumn('parent_tasks.id', 'tasks.parent_task_id')
                            ->whereColumn('parent_tasks.project_id', 'tasks.project_id');
                    });
            })
            ->orderBy('status_columns.position')
            ->orderBy('tasks.position')
            ->orderBy('tasks.title')
            ->get();
    }

    public function tasksForUser(Project $project, User $user, bool $includeCreated = false): Collection
    {
        return $this->baseTaskBoardQuery($project)
            ->where(function (Builder $outer) use ($user, $includeCreated): void {
                $outer->where(function (Builder $query) use ($user): void {
                    $query
                        ->whereHas(
                            'assignees',
                            fn ($assigneeQuery) => $assigneeQuery
                                ->withBlocked()
                                ->where('users.id', $user->id),
                        )
                        ->where(function (Builder $treeQuery) use ($user): void {
                            $treeQuery
                                ->whereNull('tasks.parent_task_id')
                                ->orWhereNotExists(function ($parentQuery) use ($user): void {
                                    $parentQuery
                                        ->selectRaw('1')
                                        ->from('tasks as parent_tasks')
                                        ->join('task_users as parent_task_users', 'parent_task_users.task_id', '=', 'parent_tasks.id')
                                        ->whereColumn('parent_tasks.id', 'tasks.parent_task_id')
                                        ->whereColumn('parent_tasks.project_id', 'tasks.project_id')
                                        ->where('parent_task_users.user_id', $user->id);
                                });
                        });
                });

                // Создатель всегда видит свои задачи, даже не назначив себя исполнителем.
                if ($includeCreated) {
                    $outer->orWhere('tasks.created_by_id', $user->id);
                }
            })
            ->orderBy('status_columns.position')
            ->orderBy('tasks.position')
            ->orderBy('tasks.title')
            ->get();
    }

    public function task(Project $project, Task $task): Task
    {
        $boardTask = $this->baseTaskBoardQuery($project)
            ->where('tasks.id', $task->id)
            ->firstOrFail();

        if (! $boardTask instanceof Task) {
            throw new \RuntimeException('Запрос доски задач не вернул модель задачи.');
        }

        return $boardTask;
    }

    public function createTask(Project $project, array $attributes, array $assigneeIds): Task
    {
        return DB::transaction(function () use ($project, $attributes, $assigneeIds): Task {
            $columnId = $attributes['task_status_column_id'] ?? null;

            unset($attributes['task_status_column_id']);

            Task::query()
                ->where('project_id', $project->id)
                ->when(
                    $columnId,
                    fn ($query) => $query->where('task_status_column_id', $columnId),
                    fn ($query) => $query->whereNull('task_status_column_id'),
                )
                ->increment('position');

            $task = Task::create([
                ...$attributes,
                'project_id' => $project->id,
                'position' => 0,
                'task_status_column_id' => $columnId,
            ]);
            // Номер выдаёт триггер БД при вставке, модель о нём не знает.
            $task->number = Task::query()->whereKey($task->id)->value('number');

            if ($assigneeIds !== []) {
                $task->assignees()->sync($assigneeIds);
            }

            $this->updateDraftStatus($task);

            return $task;
        });
    }

    public function updateTask(Task $task, array $attributes, array $assigneeIds): Task
    {
        return DB::transaction(function () use ($task, $attributes, $assigneeIds): Task {
            $task->update($attributes);
            $task->assignees()->sync($assigneeIds);

            $this->updateDraftStatus($task);

            return $task->fresh();
        });
    }

    public function updateDraftStatus(Task $task): void
    {
        $hasTime = $task->workSegments()->exists();

        $hasTitle = trim((string) $task->title) !== '';
        $hasAssignees = $task->assignees()->exists();

        $shouldBeDraft = ! $hasTime && (! $hasTitle || ! $hasAssignees);

        if ($task->is_draft !== $shouldBeDraft) {
            $task->is_draft = $shouldBeDraft;

            if (! $shouldBeDraft && ! $task->published_at) {
                $task->update([
                    'published_at' => now(),
                ]);
            }

            $task->save();
        }
    }

    public function deleteTask(Task $task): void
    {
        DB::transaction(function () use ($task): void {
            $lockedTask = Task::query()->lockForUpdate()->findOrFail($task->id);

            if ($lockedTask->workSegments()->exists()) {
                throw ValidationException::withMessages([
                    'task_id' => ['По задаче уже есть затреканное время. Перенесите его в другую задачу, затем удалите задачу.'],
                ]);
            }

            $projectId = (string) $lockedTask->project_id;
            $columnId = $lockedTask->task_status_column_id
                ? (string) $lockedTask->task_status_column_id
                : null;
            $lockedTask->delete();

            if ($columnId !== null) {
                $this->reorderColumn($projectId, $columnId);
            }
        });
    }

    public function moveTask(
        Project $project,
        Task $task,
        string $targetColumnId,
        int $destinationIndex,
    ): Task {
        return DB::transaction(function () use ($project, $task, $targetColumnId, $destinationIndex): Task {
            $sourceColumnId = (string) $task->task_status_column_id;

            $targetColumn = TaskStatusColumn::query()
                ->where('project_id', $project->id)
                ->findOrFail($targetColumnId);

            if ($sourceColumnId !== '') {
                $this->reorderColumn((string) $project->id, $sourceColumnId, (string) $task->id);
            }

            $task->task_status_column_id = $targetColumn->id;
            $task->position = 0;
            $task->save();

            $destinationTaskIds = Task::query()
                ->where('project_id', $project->id)
                ->where('task_status_column_id', $targetColumn->id)
                ->where('id', '!=', $task->id)
                ->orderBy('position')
                ->orderBy('id')
                ->pluck('id')
                ->values()
                ->all();

            $insertAt = max(0, min($destinationIndex, count($destinationTaskIds)));
            array_splice($destinationTaskIds, $insertAt, 0, [$task->id]);

            $this->applyPositions($destinationTaskIds);

            return $task->fresh()->load(['assignees', 'statusColumn']);
        });
    }

    public function projectMemberUserIds(Project $project): Collection
    {
        return ProjectMember::query()
            ->where('project_id', $project->id)
            ->pluck('user_id')
            ->values();
    }

    public function taskStatusColumns(Project $project): Collection
    {
        return $project->taskStatusColumns()
            ->orderBy('position')
            ->get();
    }

    public function visibleStatusColumns(User $user): Collection
    {
        $columns = TaskStatusColumn::query()
            ->whereHas('project', function ($query) use ($user) {
                $query->where('company_id', $user->company_id);
            });

        if (! $user->can(UserPermission::TASKS_VIEW_ALL->value)) {
            if ($user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)) {
                $columns->whereHas('project.members', function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                });
            } else {
                $columns->where(function ($query) use ($user) {
                    $query
                        ->whereHas('project.tasks.assignees', function ($assigneeQuery) use ($user) {
                            $assigneeQuery->where('users.id', $user->id);
                        })
                        ->orWhereHas('project.tasks', function ($taskQuery) use ($user) {
                            $taskQuery->where('created_by_id', $user->id);
                        });
                });
            }
        }

        return $columns
            ->orderBy('position')
            ->orderBy('name')
            ->get();
    }

    public function userBoardTasks(User $user, array $filters): Collection
    {
        $durationSubquery = DB::table('work_segments as seg')
            ->selectRaw('seg.task_id, COALESCE(SUM('.self::SEGMENT_DURATION_SQL.'), 0) as spent_seconds')
            ->groupBy('seg.task_id');

        $tasks = Task::query()
            ->with(array_merge([
                'project:id,name,company_id',
                'statusColumn:id,project_id,slug,name,color,position,is_final',
                'assignees:id,name,last_name,email',
            ], $this->subtaskRelations()))
            ->leftJoinSub($durationSubquery, 'task_durations', function ($join): void {
                $join->on('task_durations.task_id', '=', 'tasks.id');
            })
            ->selectRaw('tasks.*, COALESCE(task_durations.spent_seconds, 0) as spent_seconds')
            ->whereHas('project', function ($query) use ($user) {
                $query->where('company_id', $user->company_id);
            })
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where('title', 'ILIKE', "%{$search}%");
            });

        if (! $user->can(UserPermission::TASKS_VIEW_ALL->value)) {
            if ($user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)) {
                $tasks->whereHas('project.members', function ($query) use ($user) {
                    $query->where('user_id', $user->id);
                });
                $tasks->where(function (Builder $query): void {
                    $query
                        ->whereNull('tasks.parent_task_id')
                        ->orWhereNotExists(function ($parentQuery): void {
                            $parentQuery
                                ->selectRaw('1')
                                ->from('tasks as parent_tasks')
                                ->whereColumn('parent_tasks.id', 'tasks.parent_task_id')
                                ->whereColumn('parent_tasks.project_id', 'tasks.project_id');
                        });
                });
            } else {
                $tasks->where(function (Builder $outer) use ($user): void {
                    $outer->where(function (Builder $query) use ($user): void {
                        $query
                            ->whereHas('assignees', function ($assigneeQuery) use ($user) {
                                $assigneeQuery->where('users.id', $user->id);
                            })
                            ->where(function (Builder $treeQuery) use ($user): void {
                                $treeQuery
                                    ->whereNull('tasks.parent_task_id')
                                    ->orWhereNotExists(function ($parentQuery) use ($user): void {
                                        $parentQuery
                                            ->selectRaw('1')
                                            ->from('tasks as parent_tasks')
                                            ->join('task_users as parent_task_users', 'parent_task_users.task_id', '=', 'parent_tasks.id')
                                            ->whereColumn('parent_tasks.id', 'tasks.parent_task_id')
                                            ->whereColumn('parent_tasks.project_id', 'tasks.project_id')
                                            ->where('parent_task_users.user_id', $user->id);
                                    });
                            });
                    });

                    // Создатель всегда видит свои задачи в общем списке задач.
                    $outer->orWhere('tasks.created_by_id', $user->id);
                });
            }
        } else {
            $tasks->where(function (Builder $query): void {
                $query
                    ->whereNull('tasks.parent_task_id')
                    ->orWhereNotExists(function ($parentQuery): void {
                        $parentQuery
                            ->selectRaw('1')
                            ->from('tasks as parent_tasks')
                            ->whereColumn('parent_tasks.id', 'tasks.parent_task_id')
                            ->whereColumn('parent_tasks.project_id', 'tasks.project_id');
                    });
            });
        }

        return $tasks
            ->orderBy('position')
            ->get();
    }

    public function statusColumnBySlug(Task $task, string $statusSlug): ?TaskStatusColumn
    {
        return TaskStatusColumn::query()
            ->where('project_id', $task->project_id)
            ->where('slug', $statusSlug)
            ->first();
    }

    private function baseTaskBoardQuery(Project $project)
    {
        // Время считаем только по задачам проекта, а не по всей таблице work_segments.
        $projectTaskIds = DB::table('tasks')->select('id')->where('project_id', $project->id);
        $durationSubquery = DB::table('work_segments as seg')
            ->selectRaw('seg.task_id, COALESCE(SUM('.self::SEGMENT_DURATION_SQL.'), 0) as spent_seconds')
            ->whereIn('seg.task_id', $projectTaskIds)
            ->groupBy('seg.task_id');
        $spentByUsersSubquery = DB::query()
            ->fromSub(
                DB::table('work_segments as seg')
                    ->join('users', 'users.id', '=', 'seg.user_id')
                    ->whereIn('seg.task_id', $projectTaskIds)
                    ->selectRaw(
                        'seg.task_id,
                        users.id as user_id,
                        users.name,
                        users.last_name,
                        COALESCE(SUM('.self::SEGMENT_DURATION_SQL.'), 0) as spent_seconds'
                    )
                    ->groupBy('seg.task_id', 'users.id', 'users.name', 'users.last_name'),
                'task_user_durations'
            )
            ->selectRaw(
                "task_user_durations.task_id,
                COALESCE(
                    jsonb_agg(
                        jsonb_build_object(
                            'user_id', task_user_durations.user_id,
                            'name', task_user_durations.name,
                            'last_name', task_user_durations.last_name,
                            'spent_seconds', task_user_durations.spent_seconds
                        )
                        ORDER BY task_user_durations.spent_seconds DESC, task_user_durations.name ASC, task_user_durations.last_name ASC
                    ),
                    '[]'::jsonb
                ) as spent_by_users"
            )
            ->groupBy('task_user_durations.task_id');

        return Task::query()
            ->with(array_merge([
                'project',
                'assignees:id,last_name,name,email',
                'creator:id,last_name,name,email',
                'statusColumn',
            ], $this->subtaskRelations()))
            ->where('tasks.project_id', $project->id)
            ->leftJoin('task_status_columns as status_columns', 'status_columns.id', '=', 'tasks.task_status_column_id')
            ->leftJoinSub($durationSubquery, 'task_durations', function ($join): void {
                $join->on('task_durations.task_id', '=', 'tasks.id');
            })
            ->leftJoinSub($spentByUsersSubquery, 'task_user_spent', function ($join): void {
                $join->on('task_user_spent.task_id', '=', 'tasks.id');
            })
            ->selectRaw(
                'tasks.id, tasks.number, tasks.title
                , tasks.project_id
                , tasks.parent_task_id
                , tasks.created_by_id
                , tasks.is_draft
                , tasks.is_client_visible
                , tasks.client_approval_status
                , tasks.published_at
                , tasks.task_status_column_id
                , tasks.description
                , tasks.updated_at
                , tasks.created_at
                , COALESCE(tasks.position, 0) as position
                , COALESCE(task_durations.spent_seconds, 0) as spent_seconds
                , COALESCE(task_user_spent.spent_by_users, \'[]\'::jsonb) as spent_by_users
                , tasks.priority as priority
                , tasks.estimation as estimation
                , tasks.deadline as deadline
                , tasks.start_at as start_at
                , tasks.last_activity_at
                , tasks.last_activity_by_id
                , (SELECT task_public_links.id FROM task_public_links WHERE task_public_links.task_id = tasks.id LIMIT 1) as client_public_link',
            );
    }

    private function reorderColumn(string $projectId, string $columnId, ?string $excludedTaskId = null): void
    {
        $taskIds = Task::query()
            ->where('project_id', $projectId)
            ->where('task_status_column_id', $columnId)
            ->when(
                $excludedTaskId,
                static fn ($query) => $query->where('id', '!=', $excludedTaskId)
            )
            ->orderBy('position')
            ->orderBy('id')
            ->pluck('id')
            ->values()
            ->all();

        $this->applyPositions($taskIds);
    }

    private function applyPositions(array $taskIds): void
    {
        // Один UPDATE на пачку вместо запроса на каждую задачу колонки.
        $model = new Task;
        $updatedAtColumn = $model->usesTimestamps() ? $model->getUpdatedAtColumn() : null;
        $updatedAt = $updatedAtColumn ? $model->freshTimestampString() : null;

        foreach (array_chunk(array_values($taskIds), 500, true) as $chunk) {
            $cases = '';
            foreach ($chunk as $index => $taskId) {
                $cases .= ' WHEN ? THEN '.($index + 1);
            }
            $ids = array_values($chunk);
            $placeholders = implode(', ', array_fill(0, count($ids), '?'));

            DB::update(
                'UPDATE '.$model->getTable().' SET position = CASE id'.$cases.' END'
                .($updatedAtColumn ? ', '.$updatedAtColumn.' = ?' : '')
                .' WHERE id IN ('.$placeholders.')',
                array_merge($ids, $updatedAtColumn ? [$updatedAt] : [], $ids),
            );
        }
    }

    private function subtaskRelations(): array
    {
        return [
            'subtasks:id,number,title,project_id,parent_task_id,task_status_column_id,created_by_id,is_draft,is_client_visible,client_approval_status,published_at,description,priority,estimation,deadline,start_at,last_activity_at,last_activity_by_id,position,updated_at,created_at',
            'subtasks.statusColumn:id,project_id,slug,name,color,position,is_final',
            'subtasks.assignees:id,name,last_name,email',
            'subtasks.creator:id,name,last_name,email',
        ];
    }
}
