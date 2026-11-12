<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateCompanyUnestimatedTaskLimitRequest extends PermissionRequest
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
            // Секунды, не больше 1000 часов.
            'unestimated_task_limit_seconds' => ['required', 'integer', 'min:0', 'max:3600000'],
        ];
    }
}
