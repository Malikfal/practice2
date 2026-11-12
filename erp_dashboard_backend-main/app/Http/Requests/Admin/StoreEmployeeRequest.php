<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\RoleCatalog;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends PermissionRequest
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

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'first_name' => ['required', 'string', 'max:255'],
            'last_name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(RoleCatalog::assignableValuesForCompany((string) $this->user()?->company_id))],
            'role_id' => ['sometimes', 'integer'],
            'position' => ['present', 'nullable', 'string', 'max:255'],
            'birthday' => ['present', 'nullable', 'date'],
            'phone' => ['present', 'nullable', 'string', 'max:50'],
            'socials' => ['present', 'array'],
            'socials.*' => ['string', 'max:255'],
            'skills' => ['present', 'nullable', 'string'],
            'payload' => ['nullable', 'array'],
            'payload.*' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
