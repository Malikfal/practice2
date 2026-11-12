<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;

class ProjectActivityHistoryIndexRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $actor = $this->user();
        $project = $this->route('project');

        return $actor && $project instanceof Project
            && parent::authorize()
            && $actor->canAccessProject($project);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECT_ACTIVITY_HISTORIES;
    }

    public function rules(): array
    {
        return [];
    }
}
