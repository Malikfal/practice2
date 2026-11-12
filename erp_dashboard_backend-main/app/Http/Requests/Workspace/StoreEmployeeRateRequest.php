<?php

namespace App\Http\Requests\Workspace;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Enums\PayrollProjectHoursType;
use App\Enums\PayrollRangeCalculationMethod;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;
use Illuminate\Validation\Rule;

class StoreEmployeeRateRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), ['employees.tabs.salary.view']);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW_LIST;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [
            'salary' => ['nullable', 'integer', 'min:0'],
            'salary_distribution_scope' => [
                'sometimes',
                'string',
                Rule::in(PayrollHoursScope::values()),
            ],
            'hourly_rate' => ['nullable', 'integer', 'min:0'],
            'supervised_hourly_rate' => ['nullable', 'integer', 'min:0'],
            'company_hourly_rate' => ['nullable', 'integer', 'min:0'],
            'exclude_from_supervised_hours' => ['sometimes', 'boolean'],
            'effective_from' => ['required', 'date'],
            'rate_settings' => ['sometimes', 'array'],
            'rate_settings.*.rate_type' => ['required', 'string', Rule::in(EmployeeRateType::values())],
            'rate_settings.*.is_advanced' => ['sometimes', 'boolean'],
            'rate_settings.*.default_rate' => ['nullable', 'integer', 'min:0'],
            'rate_settings.*.split_by_project_type' => ['sometimes', 'boolean'],
            'rate_settings.*.hours_scope' => ['nullable', 'string', Rule::in(PayrollHoursScope::values())],
            'rate_settings.*.range_calculation_method' => ['nullable', 'string', Rule::in(PayrollRangeCalculationMethod::values())],
            'rate_settings.*.ranges' => ['sometimes', 'array'],
            'rate_settings.*.ranges.*.project_hours_type' => ['nullable', 'string', Rule::in(PayrollProjectHoursType::values())],
            'rate_settings.*.ranges.*.from_hours' => ['required', 'numeric', 'min:0'],
            'rate_settings.*.ranges.*.to_hours' => ['nullable', 'numeric', 'min:0'],
            'rate_settings.*.ranges.*.rate' => ['required', 'integer', 'min:0'],
            'rate_settings.*.project_rates' => ['sometimes', 'array'],
            'rate_settings.*.project_rates.*.project_id' => ['required', 'string', 'uuid'],
            'rate_settings.*.project_rates.*.rate' => ['required', 'integer', 'min:0'],
        ];
    }
}
