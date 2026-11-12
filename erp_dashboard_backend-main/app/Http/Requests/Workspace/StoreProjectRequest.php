<?php

namespace App\Http\Requests\Workspace;

use App\Enums\Currency;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\ProjectPayrollExclusionScope;
use App\Enums\ProjectStatus;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class StoreProjectRequest extends PermissionRequest
{
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
            'status' => ['nullable', Rule::in(ProjectStatus::values())],
            'status_column_id' => ['nullable', 'uuid'],
            'client_id' => [
                'nullable',
                'uuid',
                Rule::exists('clients', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'budget' => ['nullable', 'integer', 'min:0'],
            // Начальная ставка проекта в копейках/центах, действует с даты создания.
            'rate' => ['nullable', 'integer', 'min:0'],
            'rate_currency' => ['sometimes', Rule::enum(Currency::class)],
            'rate_vat' => ['nullable', 'integer', 'min:0'],
            'is_internal' => ['sometimes', 'boolean'],
            'exclude_from_payroll' => ['sometimes', 'boolean'],
            'payroll_exclusion_scope' => [
                'sometimes',
                'string',
                Rule::enum(ProjectPayrollExclusionScope::class),
            ],
            'payroll_excluded_employee_ids' => [
                Rule::requiredIf(fn (): bool => $this->boolean('exclude_from_payroll')
                    && $this->input('payroll_exclusion_scope') === ProjectPayrollExclusionScope::SELECTED->value),
                'array',
                Rule::when(
                    fn (): bool => $this->boolean('exclude_from_payroll')
                        && $this->input('payroll_exclusion_scope') === ProjectPayrollExclusionScope::SELECTED->value,
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
}
