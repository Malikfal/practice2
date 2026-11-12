<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;

class ProjectAccessRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $project = $this->route('project');

        if (! $project instanceof Project) {
            return false;
        }

        return $user->canAccessProject($project);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::VIEW_ALL, PermissionAction::VIEW_ASSIGNED];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }

    public function rules(): array
    {
        return [];
    }
}
