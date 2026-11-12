<?php

namespace App\Services\Workspace;

use App\Models\Task;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Spatie\Activitylog\Models\Activity;

/**
 * Метка "Есть изменения": новое в истории задачи после того, как пользователь открывал её в последний раз.
 */
class TaskViewService
{
    // Создание задачи пишется в историю, но изменением не считается.
    private const IGNORED_EVENTS = ['created'];

    public function markViewed(User $user, Task $task): void
    {
        DB::table('task_views')->upsert(
            [[
                'user_id' => (string) $user->id,
                'task_id' => (string) $task->id,
                'viewed_at' => now(),
            ]],
            ['user_id', 'task_id'],
            ['viewed_at'],
        );
    }

    /**
     * Запоминает у задачи последнее изменение. Через DB, чтобы не трогать updated_at задачи.
     */
    public function recordActivity(Activity $activity): void
    {
        if (
            $activity->subject_type !== (new Task)->getMorphClass()
            || in_array($activity->event, self::IGNORED_EVENTS, true)
        ) {
            return;
        }

        DB::table('tasks')
            ->where('id', $activity->subject_id)
            ->update([
                'last_activity_at' => $activity->created_at ?? now(),
                'last_activity_by_id' => $activity->causer_type === (new User)->getMorphClass()
                    ? $activity->causer_id
                    : null,
            ]);
    }

    /**
     * Проставляет задачам и их подзадачам viewer_viewed_at одним запросом.
     *
     * @param  iterable<Task>  $tasks
     */
    public function attachViewerState(iterable $tasks, ?User $user): void
    {
        if (! $user) {
            return;
        }

        $all = [];
        foreach ($tasks as $task) {
            $all[] = $task;
            if ($task->relationLoaded('subtasks')) {
                foreach ($task->subtasks as $subtask) {
                    $all[] = $subtask;
                }
            }
        }

        if ($all === []) {
            return;
        }

        $viewedAt = DB::table('task_views')
            ->where('user_id', $user->id)
            ->whereIn('task_id', array_map(static fn (Task $task): string => (string) $task->id, $all))
            ->pluck('viewed_at', 'task_id');

        foreach ($all as $task) {
            $task->setAttribute('viewer_viewed_at', $viewedAt[(string) $task->id] ?? null);
            $task->setAttribute('viewer_state_loaded', true);
        }
    }

    public static function hasChanges(Task $task, ?User $viewer): bool
    {
        if (! $viewer || ! $task->getAttribute('viewer_state_loaded') || ! $task->last_activity_at) {
            return false;
        }

        if ((string) $task->last_activity_by_id === (string) $viewer->id) {
            return false;
        }

        $viewedAt = $task->getAttribute('viewer_viewed_at');

        return $viewedAt === null || $task->last_activity_at->gt(Carbon::parse($viewedAt));
    }
}
