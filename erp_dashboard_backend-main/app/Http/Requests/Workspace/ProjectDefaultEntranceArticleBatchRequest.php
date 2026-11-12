<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class ProjectDefaultEntranceArticleBatchRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS_TABS_ABOUT;
    }

    public function rules(): array
    {
        return [
            'project_ids' => ['required', 'array', 'min:1'],
            'project_ids.*' => ['required', 'uuid', 'distinct'],
        ];
    }
}
