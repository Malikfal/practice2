<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceAnalyticsGranularity;
use App\Enums\FinanceSource;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

/** Валидирует общие фильтры всех разрезов отчёта о финансовых результатах. */
class FinancialResultRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['project_ids', 'client_ids', 'manager_ids', 'finance_article_ids', 'sources', 'employee_ids'] as $key) {
            $this->merge([$key => $this->normalizeValues($key)]);
        }
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::FINANCE;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        $exists = static fn (string $table) => Rule::exists($table, 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'granularity' => ['nullable', 'string', Rule::enum(FinanceAnalyticsGranularity::class)],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['string', $exists('projects')],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['string', $exists('clients')],
            'manager_ids' => ['nullable', 'array'],
            'manager_ids.*' => ['string', $exists('users')],
            'finance_article_ids' => ['nullable', 'array'],
            'finance_article_ids.*' => ['string', $exists('finance_article')],
            'sources' => ['nullable', 'array'],
            'sources.*' => [Rule::enum(FinanceSource::class)],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', $exists('users')],
        ];
    }

    /** @return list<string> */
    private function normalizeValues(string $key): array
    {
        return collect(is_array($this->input($key)) ? $this->input($key) : [])
            ->map(static fn (mixed $value): string => trim((string) $value))
            ->filter()
            ->unique()
            ->values()
            ->all();
    }
}
