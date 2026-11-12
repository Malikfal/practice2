<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class FinanceExportRequest extends PermissionRequest
{
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
        $employeeExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
        $articleExists = Rule::exists('finance_article', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'format' => ['required', Rule::in(['csv', 'xlsx'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'type' => ['nullable', Rule::enum(FinanceType::class)],
            'sources' => ['nullable', 'array'],
            'sources.*' => [Rule::enum(FinanceSource::class)],
            'finance_article_ids' => ['nullable', 'array'],
            'finance_article_ids.*' => ['string', $articleExists],
            'project_ids' => ['nullable', 'array'],
            'project_ids.*' => ['string', $projectExists],
            'client_ids' => ['nullable', 'array'],
            'client_ids.*' => ['string', $clientExists],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['string', $employeeExists],
            'amount_from' => ['nullable', 'integer', 'min:0'],
            'amount_to' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
