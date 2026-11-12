<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class DeleteTaskCommentRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::DELETE_SELF, PermissionAction::DELETE_ALL];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS_TABS_TASKS_COMMENTS;
    }

    public function rules(): array
    {
        return [];
    }
}
