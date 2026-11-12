<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class RequestIndividualTariffRequest extends PermissionRequest {

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
            'desired_employees_count' => ['nullable', 'integer', 'min:51'],
            'desired_period_months' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
