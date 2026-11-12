<?php

namespace App\Support;

use App\Enums\UserRole;
use Spatie\Permission\Models\Role;

final class RoleCatalog
{
    /**
     * @var array<string, array<string, string>>
     */
    private static array $labelsByCompanyCache = [];

    /**
     * @return array<int, string>
     */
    public static function immutableDefaultValues(): array
    {
        return [
            UserRole::ADMIN->value,
            UserRole::MANAGER->value,
            UserRole::WORKER->value,
        ];
    }

    /**
     * @return array<int, string>
     */
    public static function assignableValuesForCompany(?string $companyId): array
    {
        $normalizedCompanyId = trim((string) $companyId);

        $dynamicRoleValues = Role::query()
            ->where('guard_name', 'web')
            ->where('company_id', $normalizedCompanyId !== '' ? $normalizedCompanyId : null)
            ->where('name', '!=', UserRole::SUPERADMIN->value)
            ->where('name', '!=', UserRole::CLIENT->value)
            ->pluck('name')
            ->map(static fn (string $name): string => trim($name))
            ->filter(static fn (string $name): bool => $name !== '')
            ->values()
            ->all();

        return array_values(array_unique(array_merge(self::immutableDefaultValues(), $dynamicRoleValues)));
    }

    /**
     * @return array<int, array{value: string, label: string}>
     */
    public static function assignableOptionsForCompany(?string $companyId): array
    {
        $normalizedCompanyId = trim((string) $companyId);
        $labels = self::labelsMapForCompany($normalizedCompanyId);

        $roles = Role::query()
            ->where('guard_name', 'web')
            ->where('company_id', $normalizedCompanyId !== '' ? $normalizedCompanyId : null)
            ->where('name', '!=', UserRole::SUPERADMIN->value)
            ->where('name', '!=', UserRole::CLIENT->value)
            ->orderByRaw("CASE name WHEN 'ADMIN' THEN 0 WHEN 'MANAGER' THEN 1 WHEN 'WORKER' THEN 2 ELSE 3 END")
            ->orderBy('name')
            ->get(['id', 'name', 'display_name']);

        return $roles
            ->map(static fn (Role $role): array => [
                'id' => (int) $role->id,
                'role_id' => (string) $role->id,
                'value' => (string) $role->name,
                'role_value' => (string) $role->name,
                'label' => $labels[(string) $role->name] ?? (UserRole::labelByValue((string) $role->name) ?? (string) $role->name),
            ])
            ->values()
            ->all();
    }

    public static function resolveRoleValueByIdForCompany(?string $companyId, int|string|null $roleId): ?string
    {
        if ($roleId === null || $roleId === '') {
            return null;
        }

        $normalizedCompanyId = trim((string) $companyId);
        $role = Role::query()
            ->where('id', (int) $roleId)
            ->where('guard_name', 'web')
            ->where('company_id', $normalizedCompanyId !== '' ? $normalizedCompanyId : null)
            ->first(['name']);

        return $role ? (string) $role->name : null;
    }

    public static function resolveRoleIdByValueForCompany(?string $companyId, ?string $roleValue): ?int
    {
        $normalizedRoleValue = trim((string) $roleValue);
        if ($normalizedRoleValue === '') {
            return null;
        }

        $normalizedCompanyId = trim((string) $companyId);
        $role = Role::query()
            ->where('name', $normalizedRoleValue)
            ->where('guard_name', 'web')
            ->where('company_id', $normalizedCompanyId !== '' ? $normalizedCompanyId : null)
            ->first(['id']);

        return $role ? (int) $role->id : null;
    }

    public static function labelForRole(?string $companyId, ?string $roleValue): ?string
    {
        $normalizedRoleValue = trim((string) $roleValue);
        if ($normalizedRoleValue === '') {
            return null;
        }

        $normalizedCompanyId = trim((string) $companyId);
        $labels = self::labelsMapForCompany($normalizedCompanyId);

        return $labels[$normalizedRoleValue] ?? UserRole::labelByValue($normalizedRoleValue) ?? $normalizedRoleValue;
    }

    /**
     * @return array<string, string>
     */
    public static function labelsMapForCompany(?string $companyId): array
    {
        $normalizedCompanyId = trim((string) $companyId);

        if (isset(self::$labelsByCompanyCache[$normalizedCompanyId])) {
            return self::$labelsByCompanyCache[$normalizedCompanyId];
        }

        $labels = [];
        foreach (UserRole::cases() as $role) {
            if ($role === UserRole::SUPERADMIN) {
                continue;
            }

            $labels[$role->value] = $role->label();
        }

        $dynamicLabels = Role::query()
            ->where('guard_name', 'web')
            ->where('company_id', $normalizedCompanyId !== '' ? $normalizedCompanyId : null)
            ->where('name', '!=', UserRole::SUPERADMIN->value)
            ->where('name', '!=', UserRole::CLIENT->value)
            ->get(['name', 'display_name']);

        foreach ($dynamicLabels as $role) {
            $name = trim((string) $role->name);
            if ($name === '') {
                continue;
            }

            $displayName = trim((string) ($role->display_name ?? ''));
            $labels[$name] = $displayName !== '' ? $displayName : (UserRole::labelByValue($name) ?? $name);
        }

        self::$labelsByCompanyCache[$normalizedCompanyId] = $labels;

        return $labels;
    }
}
