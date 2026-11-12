<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use Illuminate\Validation\Rule;

class TimeReportRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'project_ids' => $this->normalizeIds('project_ids'),
            'task_ids' => $this->normalizeIds('task_ids'),
            'user_ids' => $this->normalizeIds('user_ids'),
            'project_kinds' => $this->normalizeIds('project_kinds'),
            'manager_ids' => $this->normalizeIds('manager_ids'),
        ]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::REPORTS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        $projectExists = Rule::exists('projects', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $userExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $taskExists = Rule::exists('tasks', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->whereIn('project_id', function ($query) use ($companyId): void {
                $query->select('id')
                    ->from('projects')
                    ->where('company_id', $companyId);
            }));

        return [
            'from' => ['required', 'date', 'before_or_equal:to'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'group_by' => ['required', Rule::in(['day', 'task', 'project', 'employee'])],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['bail', 'uuid', 'distinct', $projectExists],
            'task_ids' => ['nullable', 'array'],
            'task_ids.*' => ['bail', 'uuid', 'distinct', $taskExists],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['bail', 'uuid', 'distinct', $userExists],
            'project_kinds' => ['nullable', 'array'],
            'project_kinds.*' => ['bail', 'string', 'distinct', Rule::in(TimeReportRepository::PROJECT_KINDS)],
            'manager_ids' => ['nullable', 'array'],
            'manager_ids.*' => ['bail', 'uuid', 'distinct', $userExists],
        ];
    }

    protected function normalizeIds(string $key): mixed
    {
        $value = $this->input($key);

        if (is_array($value)) {
            return array_values(array_filter(
                array_map(static fn (mixed $item): mixed => is_string($item) ? trim($item) : $item, $value),
                static fn (mixed $item): bool => $item !== '',
            ));
        }

        if (is_string($value)) {
            $value = trim($value);

            return $value !== '' ? [$value] : [];
        }

        return $value === null ? [] : $value;
    }
}
