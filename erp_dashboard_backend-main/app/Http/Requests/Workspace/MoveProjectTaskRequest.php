<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;

class MoveProjectTaskRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user || ! $project instanceof Project) {
            return false;
        }

        return $user->canPerformProjectAction($project, UserPermission::TASKS_MOVE->value);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MOVE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TASKS;
    }

    public function rules(): array
    {
        return [
            'status_column_id' => ['required', 'uuid'],
            'destination_index' => ['required', 'integer', 'min:0'],
        ];
    }
}
