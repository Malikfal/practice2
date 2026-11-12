<?php

namespace App\Services\Notifications;

use App\Enums\NotificationEvent;
use App\Models\Task;
use App\Models\User;
use App\Support\TaskAccess;

/**
 * Проверки прав получателя: уведомление получает только тот, кто видит задачу и данные события.
 */
class NotificationAccess
{
    public function canSeeEvent(User $user, bool $isClient, NotificationEvent $event): bool
    {
        if ($isClient) {
            $required = $event->clientPermissions();
            if ($required === []) {
                return true;
            }

            $permissions = $user->effectivePermissionNames();
            foreach ($required as $permission) {
                if ($permissions->contains($permission->value)) {
                    return true;
                }
            }

            return false;
        }

        $permission = $event->staffPermission();

        return $permission === null || $user->can($permission->value);
    }

    /**
     * Клиентские аккаунты отбираются запросом с учётом видимости задачи клиенту, поэтому здесь проверяются только сотрудники.
     *
     * @param  array<int, string>  $projectMemberIds
     */
    public function canSeeTask(User $user, bool $isClient, Task $task, array $projectMemberIds): bool
    {
        return $isClient || TaskAccess::canView($user, $task, $projectMemberIds);
    }
}
