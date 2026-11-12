<?php

namespace App\Support;

use App\Enums\UserPermission;
use App\Enums\UserRole;

final class ClientRolePermissions
{
    /**
     * Права сотрудников, которые по смыслу подходят клиенту и переиспользуются для роли «Клиент».
     *
     * @return array<int, string>
     */
    public static function shared(): array
    {
        return [
            UserPermission::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW->value,
            UserPermission::PROJECTS_TABS_TASKS_CLIENT_REPLY->value,
            UserPermission::PROJECTS_TABS_TASKS_CLIENT_STATUS_UPDATE->value,
            UserPermission::TASKS_CREATE_UPDATE->value,
            UserPermission::TASKS_VIEW_ALL->value,
            UserPermission::REPORTS_TASKS_VIEW->value,
            UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW->value,
        ];
    }

    /**
     * Права, которые имеют смысл только в клиентском кабинете.
     *
     * @return array<int, string>
     */
    public static function clientOnly(): array
    {
        return [
            UserPermission::CLIENT_PORTAL_ATTACHMENTS_UPLOAD->value,
            UserPermission::CLIENT_PORTAL_TASK_DESCRIPTION_VIEW->value,
            UserPermission::CLIENT_PORTAL_TASK_ESTIMATION_VIEW->value,
            UserPermission::CLIENT_PORTAL_TASK_PRIORITY_VIEW->value,
            UserPermission::CLIENT_PORTAL_TASK_DEADLINE_VIEW->value,
            UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE->value,
            UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET->value,
            UserPermission::CLIENT_PORTAL_TASK_SPENT_TIME_VIEW->value,
        ];
    }

    /**
     * Все права, которые можно выдать роли «Клиент» или клиентскому аккаунту.
     *
     * @return array<int, string>
     */
    public static function editable(): array
    {
        return [...self::shared(), ...self::clientOnly()];
    }

    /**
     * Права новой роли «Клиент» по умолчанию.
     *
     * @return array<int, string>
     */
    public static function defaults(): array
    {
        return array_values(array_diff(self::editable(), [
            UserPermission::TASKS_CREATE_UPDATE->value,
            UserPermission::CLIENT_PORTAL_TASK_SPENT_TIME_VIEW->value,
        ]));
    }

    /**
     * Права, доступные для настройки у роли: клиенту — только клиентские, сотрудникам — все, кроме клиентских.
     *
     * @return array<int, string>
     */
    public static function availableFor(string $roleValue): array
    {
        if ($roleValue === UserRole::CLIENT->value) {
            return self::editable();
        }

        return self::withoutClientOnly(UserPermission::uiValues());
    }

    /**
     * @param  array<int, string>  $permissions
     * @return array<int, string>
     */
    public static function filterFor(string $roleValue, array $permissions): array
    {
        $allowed = self::availableFor($roleValue);

        return array_values(array_filter(
            $permissions,
            static fn (string $permission): bool => in_array($permission, $allowed, true),
        ));
    }

    /**
     * @param  array<int, string>  $permissions
     * @return array<int, string>
     */
    public static function withoutClientOnly(array $permissions): array
    {
        return array_values(array_diff($permissions, self::clientOnly()));
    }
}
