<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;

class ProjectAssignmentHistoryIndexRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        return $user && $project instanceof Project
            && parent::authorize()
            && $user->canAccessProject($project);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECT_ASSIGNMENT_HISTORIES;
    }

    public function rules(): array
    {
        return [
            'employee_ids' => ['sometimes', 'array'],
            'employee_ids.*' => ['string', 'distinct'],
        ];
    }
}
