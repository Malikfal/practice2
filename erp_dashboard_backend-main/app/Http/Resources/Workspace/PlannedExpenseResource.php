<?php

namespace App\Http\Resources\Workspace;

use App\Enums\PlannedExpenseCalculationPeriod;
use App\Enums\PlannedExpenseFormula;
use App\Models\PlannedExpense;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PlannedExpense
 */
final class PlannedExpenseResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $formula = $this->formula instanceof PlannedExpenseFormula
            ? $this->formula
            : PlannedExpenseFormula::tryFrom((string) $this->formula);
        $calculationPeriod = $this->calculation_period instanceof PlannedExpenseCalculationPeriod
            ? $this->calculation_period
            : PlannedExpenseCalculationPeriod::tryFrom((string) $this->calculation_period);

        return [
            'id' => (string) $this->id,
            'company_id' => (string) $this->company_id,
            'finance_article_id' => (string) $this->finance_article_id,
            'article' => $this->whenLoaded('article', fn (): array => [
                'id' => (string) $this->article->id,
                'name' => (string) $this->article->name,
            ]),
            'formula' => $formula?->value ?? (string) $this->formula,
            'formula_label' => $formula?->label() ?? (string) $this->formula,
            'percentage' => $this->percentage !== null ? (float) $this->percentage : null,
            'fixed_amount' => $this->fixed_amount !== null ? (int) $this->fixed_amount : null,
            'income_article_ids' => array_values(array_map('strval', $this->income_article_ids ?? [])),
            'calculation_period' => $calculationPeriod?->value ?? (string) $this->calculation_period,
            'calculation_period_label' => $calculationPeriod?->label() ?? (string) $this->calculation_period,
            'is_active' => (bool) $this->is_active,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
