<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class TaskReportRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'project_ids' => $this->normalizeIds('project_ids', 'project_id'),
            'task_ids' => $this->normalizeIds('task_ids', 'task_id'),
            'user_ids' => $this->normalizeIds('user_ids', 'user_id'),
            'client_ids' => $this->normalizeIds('client_ids', 'client_id'),
        ]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::TASKS_VIEW;
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
                $query->select('id')->from('projects')->where('company_id', $companyId);
            }));

        return [
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
            'project_scope' => ['nullable', Rule::in(['all', 'active', 'archived'])],
            'task_scope' => ['nullable', Rule::in(['all', 'active', 'archived'])],
            'employee_scope' => ['nullable', Rule::in(['all', 'active', 'archived'])],
            'client_scope' => ['nullable', Rule::in(['all', 'active', 'archived'])],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['string', $projectExists],
            'task_ids' => ['nullable', 'array'],
            'task_ids.*' => ['string', $taskExists],
            'user_ids' => ['nullable', 'array'],
            'user_ids.*' => ['string', $userExists],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['string'],
            'project_id' => ['nullable', $projectExists],
            'task_id' => ['nullable', $taskExists],
            'user_id' => ['nullable', $userExists],
            'client_id' => ['nullable', 'string'],
        ];
    }

    private function normalizeIds(string $multiKey, string $singleKey): array
    {
        $multiValue = $this->input($multiKey);

        if (is_array($multiValue)) {
            return array_values(array_filter(
                array_map(static fn (mixed $value): string => trim((string) $value), $multiValue),
                static fn (string $value): bool => $value !== '',
            ));
        }

        if (is_string($multiValue)) {
            $value = trim($multiValue);
            return $value !== '' ? [$value] : [];
        }

        $singleValue = trim((string) $this->input($singleKey, ''));
        return $singleValue !== '' ? [$singleValue] : [];
    }
}
