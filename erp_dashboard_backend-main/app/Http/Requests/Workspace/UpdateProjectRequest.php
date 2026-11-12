<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\ProjectManagerPaymentMethod;
use App\Enums\ProjectPayrollExclusionScope;
use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use Illuminate\Validation\Rule;

class UpdateProjectRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user || ! $project instanceof Project) {
            return false;
        }

        return $user->canPerformProjectAction($project, UserPermission::PROJECTS_CREATE_UPDATE->value);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::in(ProjectStatus::values())],
            'client_id' => [
                'nullable',
                'uuid',
                Rule::exists('clients', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'budget' => ['nullable', 'integer', 'min:0'],
            // Секунды в неделю, не больше 1000 часов; null — лимит не задан.
            'weekly_limit_seconds' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:3600000'],
            'manager_payment_method' => ['sometimes', 'string', Rule::in(ProjectManagerPaymentMethod::values())],
            'is_internal' => ['sometimes', 'boolean'],
            'exclude_from_payroll' => ['sometimes', 'boolean'],
            'payroll_exclusion_scope' => [
                'sometimes',
                'string',
                Rule::enum(ProjectPayrollExclusionScope::class),
            ],
            'payroll_excluded_employee_ids' => [
                Rule::requiredIf($this->switchesToSelectedPayrollExclusion()),
                'array',
                Rule::when(
                    $this->usesSelectedPayrollExclusion(),
                    ['min:1'],
                ),
            ],
            'payroll_excluded_employee_ids.*' => [
                'uuid',
                'distinct',
                Rule::exists('users', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
        ];
    }

    private function switchesToSelectedPayrollExclusion(): bool
    {
        $project = $this->route('project');
        $currentlyEnabled = (bool) ($project?->exclude_from_payroll ?? false);
        $enabled = $this->has('exclude_from_payroll')
            ? $this->boolean('exclude_from_payroll')
            : $currentlyEnabled;
        $currentScope = $project?->payroll_exclusion_scope instanceof ProjectPayrollExclusionScope
            ? $project->payroll_exclusion_scope->value
            : (string) ($project?->payroll_exclusion_scope ?? ProjectPayrollExclusionScope::ALL->value);
        $scope = (string) $this->input('payroll_exclusion_scope', $currentScope);

        return $enabled
            && $scope === ProjectPayrollExclusionScope::SELECTED->value
            && ($scope !== $currentScope || ! $currentlyEnabled);
    }

    private function usesSelectedPayrollExclusion(): bool
    {
        $project = $this->route('project');
        $enabled = $this->has('exclude_from_payroll')
            ? $this->boolean('exclude_from_payroll')
            : (bool) ($project?->exclude_from_payroll ?? false);
        $currentScope = $project?->payroll_exclusion_scope instanceof ProjectPayrollExclusionScope
            ? $project->payroll_exclusion_scope->value
            : (string) ($project?->payroll_exclusion_scope ?? ProjectPayrollExclusionScope::ALL->value);

        return $enabled
            && $this->input('payroll_exclusion_scope', $currentScope)
                === ProjectPayrollExclusionScope::SELECTED->value;
    }
}
