<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserRole;
use App\Http\Requests\PermissionRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends PermissionRequest
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
        $displayName = trim((string) $this->input('display_name', ''));
        $role = $this->generateRoleCodeFromDisplayName($displayName);

        $this->merge([
            'role' => $role,
            'display_name' => $displayName,
        ]);
    }

    public function rules(): array
    {
        return [
            'role' => [
                'required',
                'string',
                'min:2',
                'max:50',
                'regex:/^[A-Z][A-Z0-9_]*$/',
                Rule::notIn([UserRole::SUPERADMIN->value]),
            ],
            'display_name' => ['required', 'string', 'min:2', 'max:120'],
        ];
    }

    private function generateRoleCodeFromDisplayName(string $displayName): string
    {
        $ascii = Str::ascii($displayName);
        $normalized = preg_replace('/[^A-Za-z0-9]+/', '_', $ascii) ?? '';
        $normalized = trim($normalized, '_');
        $normalized = strtoupper($normalized);
        if ($normalized === '') {
            return 'ROLE';
        }

        return preg_match('/^[A-Z]/', $normalized) ? $normalized : ('ROLE_' . $normalized);
    }
}
