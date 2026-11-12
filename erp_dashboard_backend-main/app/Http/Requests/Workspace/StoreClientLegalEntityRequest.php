<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class StoreClientLegalEntityRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::CLIENTS;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'legal_address' => ['required', 'string', 'max:10000'],
            'postal_code' => ['required', 'string', 'max:32'],
            'inn' => ['required', 'string', 'max:32'],
            'kpp' => ['nullable', 'string', 'max:32'],
            'ogrn' => ['nullable', 'string', 'max:32'],
            'signer_last_name' => ['nullable', 'string', 'max:255'],
            'signer_first_name' => ['nullable', 'string', 'max:255'],
            'signer_middle_name' => ['nullable', 'string', 'max:255'],
            'signer_position' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
        ];
    }
}
