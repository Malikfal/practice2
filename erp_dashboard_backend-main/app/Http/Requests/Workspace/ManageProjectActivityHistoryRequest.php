<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use App\Models\ProjectActivityHistory;

class ManageProjectActivityHistoryRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $actor = $this->user();
        $project = $this->route('project');
        $activity = $this->route('activity');

        if (! $project instanceof Project && is_string($this->input('project_id'))) {
            $project = Project::query()->find($this->input('project_id'));
        }

        if ($activity instanceof ProjectActivityHistory) {
            $activity->loadMissing('project');
            $project = $activity->project;
        }

        return $actor && $project instanceof Project
            && parent::authorize()
            && $actor->canAccessAssignedProject($project);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
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
