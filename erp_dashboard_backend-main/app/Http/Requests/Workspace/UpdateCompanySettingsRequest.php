<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateCompanySettingsRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::SETTINGS;
    }

    public function rules(): array
    {
        return [
            'requisites' => ['nullable', 'array'],
            'requisites.legal_name' => ['nullable', 'string'],
            'requisites.address' => ['nullable', 'string'],
            'requisites.inn' => ['nullable', 'string', 'max:12'],
            'requisites.kpp' => ['nullable', 'string', 'max:9'],
            'requisites.phone' => ['nullable', 'string', 'max:12'],
            'requisites.contact_email' => ['nullable', 'string', 'max:255'],
            'requisites.ogrn' => ['nullable', 'string', 'max:15'],
            'requisites.mail_adress' => ['nullable', 'string'],
        ];
    }
}
