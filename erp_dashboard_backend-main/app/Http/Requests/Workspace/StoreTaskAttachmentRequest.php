<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Task;
use App\Models\Project;

class StoreTaskAttachmentRequest extends PermissionRequest {
    public function authorize(): bool
    {
        $user = $this->user();
        $task = $this->route('task');

        if (! $user || ! $task instanceof Task) {
            return false;
        }

        $task->loadMissing('project');
        $project = $task->project;

        if (! $project instanceof Project){
            return false;
        }

        return $user->canPerformProjectAction($project, UserPermission::TASKS_CREATE_UPDATE->value);
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
        return [
            'file' => [
                'required',
                'file',
                'max:20480', // 20 Мб
            ],
        ];
    }
}