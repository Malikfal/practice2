<?php

namespace App\Http\Requests\Workspace;

use App\Enums\UserPermission;
use App\Models\Task;
use Illuminate\Foundation\Http\FormRequest;

class TaskPublicLinkManageRequest extends FormRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $task = $this->route('task');

        if (! $user || ! $task instanceof Task) return false;
        if (! $user->canAccessProject($task->project)) return false;

        return $user->can(UserPermission::PROJECTS_TABS_TASKS_CLIENT_LINK_MANAGE->value);
    }

    public function rules(): array
    {
        return [];
    }
}