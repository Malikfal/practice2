<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class MoveTimeEntryRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::DELETE_SELF, PermissionAction::DELETE_OTHERS, PermissionAction::DELETE_ALL];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TIME;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        $projectExists = Rule::exists('projects', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $taskExists = Rule::exists('tasks', 'id')
            ->where(fn ($query) => $query->where('is_draft', false))
            ->when($companyId !== '', fn ($rule) => $rule->whereIn('project_id', function ($query) use ($companyId): void {
                $query->select('id')
                    ->from('projects')
                    ->where('company_id', $companyId);
            }));

        return [
            "move_from" => ['required', 'integer', 'min:0'],
            "move_to" => ['required', 'integer', 'min:0'],
            "destination_project_id" => ['required', $projectExists],
            "destination_task_id" => ['nullable', $taskExists, 'required_without:new_task_title'],
            "new_task_title" => ['nullable', 'string', 'max:255', 'required_without:destination_task_id'],
        ];
    }
}
