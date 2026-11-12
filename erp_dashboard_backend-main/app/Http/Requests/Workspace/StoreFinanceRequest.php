<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class StoreFinanceRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::FINANCE;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'project_id' => [
                'nullable',
                'string',
                Rule::exists('projects', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'finance_article_id' => [
                'nullable',
                'string',
                Rule::exists('finance_article', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'employee_id' => [
                'nullable',
                'string',
                Rule::exists('users', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'amount' => ['required', 'integer', 'min:0'],
            'type' => ['required', Rule::enum(FinanceType::class)],
            'comment' => ['nullable', 'string'],
            'dateOfPayment' => ['required', 'date'],
            'distribution_from' => ['sometimes', 'required_with:distribution_to', 'date'],
            'distribution_to' => [
                'sometimes',
                'required_with:distribution_from',
                'date',
                'after_or_equal:distribution_from',
            ],
            'distribution_method' => [
                'sometimes',
                Rule::enum(FinanceArticleDistributionMethod::class),
            ],
            'distribution_project_mode' => [
                'sometimes',
                Rule::enum(FinanceDistributionProjectMode::class),
            ],
            'distribution_project_ids' => [
                'exclude_unless:distribution_project_mode,'.FinanceDistributionProjectMode::SELECTED->value,
                'required',
                'array',
                'min:1',
            ],
            'distribution_project_ids.*' => [
                'string',
                'distinct',
                Rule::exists('projects', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
        ];
    }
}
