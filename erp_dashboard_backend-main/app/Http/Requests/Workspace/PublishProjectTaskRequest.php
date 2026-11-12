<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;

class PublishProjectTaskRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        return $user
            && $project instanceof Project
            && $user->canPerformProjectAction($project, UserPermission::TASKS_CREATE_UPDATE->value);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TASKS;
    }

    public function rules(): array
    {
        return [];
    }
}
