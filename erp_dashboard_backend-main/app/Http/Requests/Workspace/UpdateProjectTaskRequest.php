<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\TaskPriority;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Validation\Rule;

class UpdateProjectTaskRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user || ! $project instanceof Project) {
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
        $task = $this->route('task');
        $companyId = (string) $this->attributes->get('company_id', '');
        $userExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'title' => ($task instanceof Task && $task->workSegments()->exists())
                ? ['required', 'string', 'max:255']
                : ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string'],
            'assignee_ids' => ['sometimes', 'nullable', 'array'],
            'assignee_ids.*' => ['string', 'distinct', $userExists],
            'priority' => ['sometimes', 'nullable', 'string', Rule::enum(TaskPriority::class)],
            'estimation' => ['sometimes', 'nullable', 'integer', 'min:0'],
            'deadline' => ['sometimes', 'nullable', 'date'],
            'start_at' => ['sometimes', 'nullable', 'date'],
            'parent_task_id' => ['sometimes', 'nullable', 'uuid'],
            'is_client_visible' => ['sometimes', 'boolean'],
        ];
    }
}
