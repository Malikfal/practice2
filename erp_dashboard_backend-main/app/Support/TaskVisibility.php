<?php

namespace App\Support;

use App\Models\Task;
use Illuminate\Support\Facades\DB;

class TaskVisibility
{
    public static function isVisibleByAssignedTree(Task $task, string $projectId, string $userId): bool
    {
        // Создатель задачи всегда видит её, даже если не назначил себя исполнителем.
        if ((string) $task->created_by_id === $userId) {
            return true;
        }

        $assignedTaskIds = DB::table('task_users')
            ->where('user_id', $userId)
            ->pluck('task_id')
            ->map(static fn ($id): string => (string) $id)
            ->all();

        if ($assignedTaskIds === []) {
            return false;
        }

        $assignedSet = array_fill_keys($assignedTaskIds, true);

        $tasksById = Task::query()
            ->where('project_id', $projectId)
            ->select(['id', 'parent_task_id'])
            ->get()
            ->keyBy(static fn (Task $item): string => (string) $item->id);

        return self::hasAssignedAncestor(
            (string) $task->id,
            $assignedSet,
            $tasksById->all(),
            [],
        );
    }

    /**
     * @param array<string, bool> $assignedSet
     * @param array<string, Task> $tasksById
     * @param array<string, bool> $visited
     */
    private static function hasAssignedAncestor(
        string $taskId,
        array $assignedSet,
        array $tasksById,
        array $visited,
    ): bool {
        if ($taskId === '') {
            return false;
        }

        if (isset($visited[$taskId])) {
            // Safety against accidental cyclic links in corrupted data.
            return false;
        }

        if (isset($assignedSet[$taskId])) {
            return true;
        }

        $task = $tasksById[$taskId] ?? null;
        if (! $task) {
            return false;
        }

        $visited[$taskId] = true;

        return self::hasAssignedAncestor(
            (string) $task->parent_task_id,
            $assignedSet,
            $tasksById,
            $visited,
        );
    }
}
