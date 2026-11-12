<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Services\Workspace\Reports\HoursChartReportService;
use Illuminate\Validation\Rule;

/**
 * Фильтры отчета по времени плюс клиенты; группировка — по дням, неделям или месяцам.
 */
class HoursChartReportRequest extends TimeReportRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        $this->merge(['client_ids' => $this->normalizeIds('client_ids')]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::HOURS_CHART_VIEW;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        $clientExists = Rule::exists('clients', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            ...parent::rules(),
            'group_by' => ['sometimes', Rule::in(HoursChartReportService::GROUPS)],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['bail', 'uuid', 'distinct', $clientExists],
        ];
    }
}
