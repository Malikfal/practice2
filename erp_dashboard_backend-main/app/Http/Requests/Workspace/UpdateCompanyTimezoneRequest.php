<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateCompanyTimezoneRequest extends PermissionRequest
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
            'timezone' => ['required', 'timezone'],
        ];
    }
}
