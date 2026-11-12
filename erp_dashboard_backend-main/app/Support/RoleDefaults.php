<?php

namespace App\Support;

use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Models\User;

final class RoleDefaults
{
    /**
     * @return array<string, array<int, string>>
     */
    public static function rolePermissionMap(): array
    {
        $worker = self::permissions(
            UserPermission::PROJECTS_VIEW_ASSIGNED,
            UserPermission::PROJECTS_TABS_ABOUT_VIEW,
            UserPermission::PROJECTS_TABS_TASKS_VIEW,
            UserPermission::TASKS_VIEW_ASSIGNED,
            UserPermission::PROJECTS_TABS_TASKS_COMMENTS_DELETE_SELF,
            UserPermission::PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_SELF,
            UserPermission::KNOWLEDGE_BASE_VIEW_ASSIGNED
        );

        $manager = self::mergePermissions(
            $worker,
            self::permissions(
                UserPermission::TIME_ADD_FOR_OTHERS,
                UserPermission::TIME_VIEW_OTHERS,
                UserPermission::TIME_DELETE_OTHERS,
                UserPermission::EMPLOYEES_VIEW_LIST,
                UserPermission::EMPLOYEES_TABS_ABSENCES_VIEW,
                //UserPermission::PROJECTS_MANAGE,
                UserPermission::PROJECTS_CREATE_UPDATE,
                // UserPermission::PROJECTS_BUDGET_VIEW,
                UserPermission::PROJECTS_TABS_NOTES_VIEW,
                UserPermission::PROJECTS_TABS_DOCUMENTS_VIEW,
                UserPermission::PROJECTS_TABS_REPORTS_VIEW,
                UserPermission::PROJECTS_NOTES_CREATE_UPDATE,
                // UserPermission::PROJECTS_NOTES_ASSIGN,
                UserPermission::PROJECTS_DOCUMENTS_CREATE_UPDATE,
                // UserPermission::PROJECTS_DOCUMENTS_ASSIGN,
                UserPermission::PROJECT_MEMBERS_MANAGE,
                UserPermission::TASKS_VIEW_PROJECT_ASSIGNED,
                UserPermission::TASKS_CREATE_UPDATE,
                UserPermission::TASKS_ASSIGN,
                UserPermission::TASKS_STATUS_CREATE_UPDATE,
                UserPermission::TASKS_MOVE,
                UserPermission::PROJECTS_TABS_TASKS_COMMENTS_DELETE_ALL,
                UserPermission::PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_ALL,
                UserPermission::KNOWLEDGE_BASE_CREATE_UPDATE
            )
        );

        return [
            UserRole::SUPERADMIN->value => ClientRolePermissions::withoutClientOnly(UserPermission::values()),
            UserRole::ADMIN->value => ClientRolePermissions::withoutClientOnly(UserPermission::values()),
            UserRole::MANAGER->value => $manager,
            UserRole::WORKER->value => $worker,
            UserRole::CLIENT->value => ClientRolePermissions::defaults(),
        ];
    }

    public static function syncForCompany(string $companyId): void
    {
        foreach (self::rolePermissionMap() as $roleValue => $permissions) {
            if ($roleValue === UserRole::SUPERADMIN->value) {
                continue;
            }

            $role = User::findOrCreateScopedRole($roleValue, $companyId);
            $role->syncPermissions($permissions);
            User::flushRolePermissionCache($role->id);
        }
    }

    public static function syncSuperadminRole(): void
    {
        $role = User::findOrCreateScopedRole(UserRole::SUPERADMIN->value, '');
        $role->syncPermissions(UserPermission::values());
        User::flushRolePermissionCache($role->id);
    }

    /**
     * @return array<int, string>
     */
    private static function permissions(UserPermission ...$permissions): array
    {
        return array_map(
            static fn (UserPermission $permission): string => $permission->value,
            $permissions
        );
    }

    /**
     * @param array<int, string> ...$permissionSets
     * @return array<int, string>
     */
    private static function mergePermissions(array ...$permissionSets): array
    {
        return array_values(array_unique(array_merge(...$permissionSets)));
    }
}
