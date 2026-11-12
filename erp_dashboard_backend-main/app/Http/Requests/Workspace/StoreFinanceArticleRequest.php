<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionPeriod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class StoreFinanceArticleRequest extends PermissionRequest
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
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::enum(FinanceType::class)],
            'distribution_method' => ['sometimes', Rule::enum(FinanceArticleDistributionMethod::class)],
            'default_distribution_period' => ['sometimes', Rule::enum(FinanceDistributionPeriod::class)],
            'default_distribution_project_mode' => [
                'sometimes',
                Rule::enum(FinanceDistributionProjectMode::class),
            ],
            'default_distribution_project_ids' => [
                'exclude_unless:default_distribution_project_mode,'.FinanceDistributionProjectMode::SELECTED->value,
                'required',
                'array',
                'min:1',
            ],
            'default_distribution_project_ids.*' => [
                'string',
                'distinct',
                Rule::exists('projects', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'parent_id' => ['nullable', 'string'],
        ];
    }
}
