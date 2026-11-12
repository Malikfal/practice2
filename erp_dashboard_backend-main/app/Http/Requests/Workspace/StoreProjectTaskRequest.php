<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\TaskPriority;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use Illuminate\Validation\Rule;

class StoreProjectTaskRequest extends PermissionRequest
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
        $companyId = (string) $this->attributes->get('company_id', '');
        $userExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'title' => ['sometimes', 'nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'assignee_ids' => ['nullable', 'array'],
            'assignee_ids.*' => ['string', 'distinct', $userExists],
            'priority' => ['nullable', 'string', Rule::enum(TaskPriority::class)],
            'estimation' => ['nullable', 'integer', 'min:0'],
            'status_column_id' => ['nullable', 'uuid'],
            'deadline' => ['nullable', 'date', 'after_or_equal:now'],
            'start_at' => ['nullable', 'date'],
            'parent_task_id' => ['nullable', 'uuid'],
            'is_client_visible' => ['sometimes', 'boolean'],
        ];
    }
}
