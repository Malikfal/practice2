<?php

namespace App\Support;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;

final class RoutePermissions
{
    public const PROJECTS_VIEW_ANY = [
        PermissionSection::PROJECTS->value.'.'.PermissionAction::VIEW_ALL->value,
        PermissionSection::PROJECTS->value.'.'.PermissionAction::VIEW_ASSIGNED->value,
    ];

    public const PROJECTS_UPDATE = [
        PermissionSection::PROJECTS->value.'.'.PermissionAction::CREATE_UPDATE->value,
    ];

    public const PROJECT_MEMBERS_MANAGE = [
        PermissionSection::PROJECT_MEMBERS->value.'.'.PermissionAction::MANAGE->value,
    ];

    public const TASKS_UPDATE = [
        PermissionSection::TASKS->value.'.'.PermissionAction::CREATE_UPDATE->value,
    ];

    public const TASKS_MOVE = [
        PermissionSection::TASKS->value.'.'.PermissionAction::MOVE->value,
    ];

    public const EMPLOYEES_INDEX_ANY = [
        PermissionSection::EMPLOYEES->value.'.'.PermissionAction::VIEW_LIST->value,
        PermissionSection::PROJECT_MEMBERS->value.'.'.PermissionAction::MANAGE->value,
        PermissionSection::ROLES->value.'.'.PermissionAction::VIEW->value,
        PermissionSection::ROLES->value.'.'.PermissionAction::MANAGE->value,
    ];

    public const EMPLOYEE_DOCUMENTS_VIEW = [
        PermissionSection::EMPLOYEES_TABS_DOCUMENTS->value.'.'.PermissionAction::VIEW->value,
    ];

    public const REPORTS_VIEW_ANY = [
        PermissionSection::REPORTS->value.'.'.PermissionAction::VIEW->value,
        PermissionSection::REPORTS->value.'.'.PermissionAction::TASKS_VIEW->value,
    ];

    public const TIME_DELETE_ANY = [
        PermissionSection::TIME->value.'.'.PermissionAction::DELETE_SELF->value,
        PermissionSection::TIME->value.'.'.PermissionAction::DELETE_OTHERS->value,
        PermissionSection::TIME->value.'.'.PermissionAction::DELETE_ALL->value,
    ];

    public const TIME_ADD_ANY = [
        PermissionSection::TIME->value.'.'.PermissionAction::ADD_FOR_PROJECT_USERS->value,
        PermissionSection::TIME->value.'.'.PermissionAction::ADD_FOR_OTHERS->value,
        PermissionSection::TIME->value.'.'.PermissionAction::ADD_FOR_ALL->value,
    ];

    public const ADMIN_ROLES_ANY = [
        PermissionSection::ROLES->value.'.'.PermissionAction::VIEW->value,
        PermissionSection::ROLES->value.'.'.PermissionAction::MANAGE->value,
    ];

    /**
     * @param array<int, string> $permissions
     */
    public static function any(array $permissions): string
    {
        return 'permission:'.implode(',', $permissions);
    }

    /**
     * @param PermissionAction|array<int, PermissionAction> $actions
     * @param PermissionSection|array<int, PermissionSection> $sections
     * @return array<int, string>
     */
    public static function resolve(PermissionAction|array $actions, PermissionSection|array $sections): array
    {
        $actionList = is_array($actions) ? $actions : [$actions];
        $sectionList = is_array($sections) ? $sections : [$sections];

        $permissions = [];

        foreach ($sectionList as $section) {
            foreach ($actionList as $action) {
                $permissions[] = $section->value.'.'.$action->value;
            }
        }

        return $permissions;
    }
}
