<?php

namespace Tests\Unit\Notifications;

use App\Enums\NotificationEvent;
use App\Models\Task;
use App\Models\User;
use App\Services\Notifications\NotificationAccess;

/**
 * Права проверяются отдельно (TaskAccess), здесь важны правила получателей: по умолчанию доступ есть у всех.
 */
class AllowingNotificationAccess extends NotificationAccess
{
    /**
     * @var array<int, string>
     */
    public array $hiddenTaskFor = [];

    /**
     * Пользователь → события, данные которых ему не видны (нет права).
     *
     * @var array<string, array<int, NotificationEvent>>
     */
    public array $hiddenEventsFor = [];

    public function canSeeEvent(User $user, bool $isClient, NotificationEvent $event): bool
    {
        return ! in_array($event, $this->hiddenEventsFor[(string) $user->id] ?? [], true);
    }

    public function canSeeTask(User $user, bool $isClient, Task $task, array $projectMemberIds): bool
    {
        return ! in_array((string) $user->id, $this->hiddenTaskFor, true);
    }
}
