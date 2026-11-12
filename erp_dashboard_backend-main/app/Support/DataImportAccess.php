<?php

namespace App\Support;

use App\Enums\DataImportType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Models\User;

final class DataImportAccess
{
    public static function can(?User $user, DataImportType $type): bool
    {
        // Ставки импортирует тот, кто может менять их во вкладке «Оплата труда».
        if ($type === DataImportType::EMPLOYEE_PAYROLL) {
            return PermissionAccess::canAny($user, [UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value]);
        }

        [$action, $section] = match ($type) {
            DataImportType::FINANCES => [PermissionAction::MANAGE, PermissionSection::FINANCE],
            DataImportType::PROJECTS => [PermissionAction::CREATE_UPDATE, PermissionSection::PROJECTS],
            DataImportType::EMPLOYEES => [PermissionAction::CREATE_UPDATE, PermissionSection::EMPLOYEES],
        };

        return PermissionAccess::canAny($user, RoutePermissions::resolve($action, $section));
    }

    /** @return array<int, string> */
    public static function allowedTypes(?User $user): array
    {
        return array_values(array_map(
            static fn (DataImportType $type): string => $type->value,
            array_filter(DataImportType::cases(), static fn (DataImportType $type): bool => self::can($user, $type)),
        ));
    }
}
