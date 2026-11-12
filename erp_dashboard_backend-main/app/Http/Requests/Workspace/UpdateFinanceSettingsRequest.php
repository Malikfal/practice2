<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class UpdateFinanceSettingsRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::SETTINGS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'default_salary_finance_article_id' => [
                'nullable',
                'uuid',
                Rule::exists('finance_article', 'id')
                    ->when(
                        $companyId !== '',
                        fn ($rule) => $rule
                            ->where('company_id', $companyId)
                            ->where('type', FinanceType::EXPENDITURE->value),
                    ),
            ],
            'default_fixed_absence_finance_article_id' => [
                'nullable',
                'uuid',
                Rule::exists('finance_article', 'id')
                    ->when(
                        $companyId !== '',
                        fn ($rule) => $rule
                            ->where('company_id', $companyId)
                            ->where('type', FinanceType::EXPENDITURE->value),
                    ),
            ],
            'calculate_daily_payroll' => ['sometimes', 'boolean'],
        ];
    }
}
