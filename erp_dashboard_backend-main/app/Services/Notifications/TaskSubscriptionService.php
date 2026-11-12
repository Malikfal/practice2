<?php

namespace App\Services\Notifications;

use App\Enums\NotificationEvent;
use App\Enums\NotificationRelation;
use App\Enums\TaskSubscriptionMode;
use App\Models\Task;
use App\Models\TaskSubscription;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * «Следить» и «Не уведомлять» по отдельной задаче.
 */
class TaskSubscriptionService
{
    public function __construct(
        private readonly NotificationSettingsService $settings,
        private readonly NotificationAccess $access,
    ) {}

    /**
     * Состояние кнопки в окне задачи: личный режим, связи пользователя с задачей и кто ещё следит.
     *
     * @return array<string, mixed>
     */
    public function state(User $user, Task $task): array
    {
        $subscription = TaskSubscription::query()
            ->where('task_id', $task->id)
            ->where('user_id', $user->id)
            ->first();
        $watchers = TaskSubscription::query()
            ->where('task_id', $task->id)
            ->where('mode', TaskSubscriptionMode::WATCH->value)
            ->with('user:id,name,last_name')
            ->orderBy('created_at')
            ->get()
            ->filter(static fn (TaskSubscription $item): bool => $item->user !== null)
            ->map(static fn (TaskSubscription $item): array => [
                'id' => (string) $item->user_id,
                'name' => trim($item->user->name.' '.($item->user->getRawOriginal('last_name') ?? '')),
            ])
            ->values();

        $isClient = $this->settings->isClient($user);

        return [
            'mode' => $subscription?->mode === TaskSubscriptionMode::NONE ? null : $subscription?->mode->value,
            'source' => $subscription?->source,
            'relations' => array_map(
                static fn (NotificationRelation $relation): array => ['key' => $relation->value, 'label' => $relation->reason()],
                $this->relations($user, $task),
            ),
            // Придёт ли наблюдателю переписка с клиентом: без права её видеть — нет.
            'includes_client_messages' => ! $isClient
                && $this->access->canSeeEvent($user, false, NotificationEvent::TASK_CLIENT_MESSAGE_ADDED),
            'watchers' => $watchers,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function update(User $user, Task $task, ?TaskSubscriptionMode $mode): array
    {
        $subscription = TaskSubscription::query()
            ->where('task_id', $task->id)
            ->where('user_id', $user->id);

        // Отписка запоминается, а не удаляется: иначе следующий комментарий снова подпишет (autoWatch).
        if ($mode === null) {
            $subscription->update(['mode' => TaskSubscriptionMode::NONE->value, 'source' => TaskSubscription::SOURCE_MANUAL]);
        } else {
            TaskSubscription::query()->upsert(
                [[
                    'task_id' => $task->id,
                    'user_id' => $user->id,
                    'mode' => $mode->value,
                    'source' => TaskSubscription::SOURCE_MANUAL,
                ]],
                ['task_id', 'user_id'],
                ['mode', 'source', 'updated_at'],
            );
        }

        return $this->state($user, $task);
    }

    /**
     * Сотрудник, написавший комментарий или ответ клиенту, начинает следить за задачей.
     * Выключается в личных настройках; явный выбор по задаче («Не уведомлять» или отписка) не перезаписывается.
     */
    public function autoWatch(User $user, Task $task): void
    {
        if ($this->settings->isClient($user) || ! $this->settings->autoWatchEnabled($user)) {
            return;
        }

        $now = now();
        TaskSubscription::query()->insertOrIgnore([
            'task_id' => $task->id,
            'user_id' => $user->id,
            'mode' => TaskSubscriptionMode::WATCH->value,
            'source' => TaskSubscription::SOURCE_AUTO,
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    /**
     * Связи пользователя с задачей, кроме подписки: по ним уведомления приходят и без «Следить».
     *
     * @return array<int, NotificationRelation>
     */
    private function relations(User $user, Task $task): array
    {
        if ($this->settings->isClient($user)) {
            return [NotificationRelation::CLIENT];
        }

        $relations = [];
        if (DB::table('task_users')->where('task_id', $task->id)->where('user_id', $user->id)->exists()) {
            $relations[] = NotificationRelation::ASSIGNEE;
        }
        if ((string) $task->created_by_id === (string) $user->id) {
            $relations[] = NotificationRelation::CREATOR;
        }

        $member = DB::table('project_members')
            ->where('project_id', $task->project_id)
            ->where('user_id', $user->id)
            ->first(['is_pm']);
        if ($member !== null) {
            $relations[] = (bool) $member->is_pm ? NotificationRelation::PROJECT_MANAGER : NotificationRelation::PROJECT_MEMBER;
        }

        return $relations;
    }
}
