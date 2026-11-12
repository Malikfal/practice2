<?php

namespace App\Http\Requests\Workspace;

use App\Enums\UserPermission;
use App\Models\Task;

class DirectTaskUpdateRequest extends UpdateProjectTaskRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $task = $this->route('task');

        if (! $user || ! $task instanceof Task) {
            return false;
        }

        return $user->canPerformProjectAction($task->project, UserPermission::TASKS_CREATE_UPDATE->value);
    }
}
