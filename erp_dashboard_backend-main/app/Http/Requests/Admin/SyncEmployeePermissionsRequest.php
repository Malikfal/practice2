<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Enums\UserRole;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class SyncEmployeePermissionsRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        $allowed = array_fill_keys(UserPermission::values(), true);

        $permissions = collect((array) $this->input('permissions', []))
            ->filter(static fn (mixed $permission): bool => is_string($permission))
            ->map(static fn (string $permission): string => trim($permission))
            ->filter(static fn (string $permission): bool => $permission !== '' && isset($allowed[$permission]))
            ->values()
            ->all();

        $deniedPermissions = collect((array) $this->input('denied_permissions', []))
            ->filter(static fn (mixed $permission): bool => is_string($permission))
            ->map(static fn (string $permission): string => trim($permission))
            ->filter(static fn (string $permission): bool => $permission !== '' && isset($allowed[$permission]))
            ->values()
            ->all();

        $this->merge([
            'permissions' => $permissions,
            'denied_permissions' => $deniedPermissions,
        ]);
    }

    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        return in_array((string) $user->role, [UserRole::ADMIN->value, UserRole::SUPERADMIN->value], true)
            || parent::authorize();
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::ROLES;
    }

    public function rules(): array
    {
        return [
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', 'distinct', Rule::in(UserPermission::values())],
            'denied_permissions' => ['sometimes', 'array'],
            'denied_permissions.*' => ['string', 'distinct', Rule::in(UserPermission::values())],
        ];
    }
}
