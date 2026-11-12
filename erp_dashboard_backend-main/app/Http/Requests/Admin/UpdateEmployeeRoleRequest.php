<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserRole;
use App\Http\Requests\PermissionRequest;
use App\Support\RoleCatalog;
use Illuminate\Validation\Rule;

class UpdateEmployeeRoleRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        $role = $this->input('role');
        $roleId = $this->input('role_id');
        if (is_string($role) && trim($role) !== '') {
            $resolvedRoleId = RoleCatalog::resolveRoleIdByValueForCompany(
                (string) $this->user()?->company_id,
                $role,
            );
            if ($resolvedRoleId !== null) {
                $this->merge(['role_id' => (string) $resolvedRoleId]);
            }
            return;
        }

        $resolvedRole = RoleCatalog::resolveRoleValueByIdForCompany(
            (string) $this->user()?->company_id,
            $roleId,
        );

        if ($resolvedRole !== null) {
            $this->merge(['role' => $resolvedRole]);
        }
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
            'role' => ['required', Rule::in(RoleCatalog::assignableValuesForCompany((string) $this->user()?->company_id))],
            'role_id' => ['sometimes', 'integer'],
        ];
    }
}
