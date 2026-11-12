<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateTrackerSettingsRequest extends PermissionRequest
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
            'default_task_status_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'client_task_status_name' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
