<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceAnalyticsGranularity;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class FinanceAnalyticsRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'project_ids' => $this->normalizeIds('project_ids'),
            'client_ids' => $this->normalizeIds('client_ids'),
            'manager_ids' => $this->normalizeIds('manager_ids'),
        ]);
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
        $projectExists = Rule::exists('projects', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $clientExists = Rule::exists('clients', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $managerExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'granularity' => ['nullable', 'string', Rule::enum(FinanceAnalyticsGranularity::class)],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['string', $projectExists],
            'project_id' => ['prohibited'],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['string', $clientExists],
            'client_id' => ['prohibited'],
            'manager_ids' => ['nullable', 'array'],
            'manager_ids.*' => ['string', $managerExists],
            'manager_id' => ['prohibited'],
            'unaccounted_income_page' => ['nullable', 'integer', 'min:1'],
            'unaccounted_expenses_page' => ['nullable', 'integer', 'min:1'],
            'unaccounted_per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }

    private function normalizeIds(string $key): array
    {
        $value = $this->input($key);
        $normalized = [];

        if (is_array($value)) {
            foreach ($value as $item) {
                $stringValue = trim((string) $item);

                if ($stringValue !== '') {
                    $normalized[$stringValue] = true;
                }
            }
        }

        return array_keys($normalized);
    }
}
