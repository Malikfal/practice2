<?php

namespace App\Http\Requests\Workspace;

use App\Models\Task;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class DirectTaskAccessRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $task = $this->route('task');

        if (! $task instanceof Task) {
            return false;
        }

        return $user->canAccessProject($task->project);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::VIEW_ALL, PermissionAction::VIEW_ASSIGNED];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }
}