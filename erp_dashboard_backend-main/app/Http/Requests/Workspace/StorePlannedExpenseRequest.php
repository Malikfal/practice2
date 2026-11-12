<?php

namespace App\Http\Requests\Workspace;

use App\Enums\FinanceType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\PlannedExpenseCalculationPeriod;
use App\Enums\PlannedExpenseFormula;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class StorePlannedExpenseRequest extends PermissionRequest
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
        $incomeArticleExists = Rule::exists('finance_article', 'id')
            ->where('type', FinanceType::ENTRANCE->value)
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'finance_article_id' => ['required', 'uuid', 'exists:finance_article,id'],
            'formula' => ['required', Rule::enum(PlannedExpenseFormula::class)],
            'percentage' => [
                Rule::requiredIf($this->input('formula') === PlannedExpenseFormula::PERCENT_OF_INCOME->value),
                'nullable',
                'numeric',
                'gt:0',
                'max:100',
                'decimal:0,4',
            ],
            'fixed_amount' => [
                Rule::requiredIf($this->input('formula') === PlannedExpenseFormula::FIXED_AMOUNT->value),
                'nullable',
                'integer',
                'min:1',
            ],
            'income_article_ids' => ['nullable', 'array'],
            'income_article_ids.*' => ['uuid', 'distinct', $incomeArticleExists],
            'calculation_period' => ['required', Rule::enum(PlannedExpenseCalculationPeriod::class)],
            'is_active' => ['required', 'boolean'],
        ];
    }
}
