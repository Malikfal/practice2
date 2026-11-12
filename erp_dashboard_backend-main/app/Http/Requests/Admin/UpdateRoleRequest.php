<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserRole;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class UpdateRoleRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::ROLES;
    }

    protected function prepareForValidation(): void
    {
        $rawRole = $this->input('role');
        $role = is_string($rawRole) ? strtoupper(trim($rawRole)) : null;
        $displayName = trim((string) $this->input('display_name', ''));

        $payload = ['display_name' => $displayName];
        if ($role !== null) {
            $payload['role'] = $role;
        }

        $this->merge($payload);
    }

    public function rules(): array
    {
        return [
            'role' => [
                'sometimes',
                'string',
                'min:2',
                'max:50',
                'regex:/^[A-Z][A-Z0-9_]*$/',
                Rule::notIn([UserRole::SUPERADMIN->value]),
            ],
            'display_name' => ['required', 'string', 'min:2', 'max:120'],
        ];
    }
}
