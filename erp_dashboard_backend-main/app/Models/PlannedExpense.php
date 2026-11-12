<?php

namespace App\Models;

use App\Enums\PlannedExpenseCalculationPeriod;
use App\Enums\PlannedExpenseFormula;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Регулярный или расчётный плановый расход.
 *
 * @property string $id
 * @property string $company_id
 * @property string $finance_article_id
 * @property PlannedExpenseFormula $formula
 * @property PlannedExpenseCalculationPeriod $calculation_period
 * @property bool $is_active
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $percentage
 * @property int|null $fixed_amount
 * @property array<string, mixed>|null $income_article_ids
 * @property-read Company|null $company
 * @property-read FinanceArticle|null $article
 */
class PlannedExpense extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'finance_article_id',
        'formula',
        'percentage',
        'fixed_amount',
        'income_article_ids',
        'calculation_period',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'formula' => PlannedExpenseFormula::class,
            'percentage' => 'decimal:4',
            'fixed_amount' => 'integer',
            'income_article_ids' => 'array',
            'calculation_period' => PlannedExpenseCalculationPeriod::class,
            'is_active' => 'boolean',
        ];
    }

    public function calculateAmount(?int $income): int
    {
        return match ($this->formula) {
            PlannedExpenseFormula::PERCENT_OF_INCOME => $income > 0 && $this->percentage !== null
                ? (int) round($income * (float) $this->percentage / 100)
                : 0,
            PlannedExpenseFormula::FIXED_AMOUNT => max(0, (int) ($this->fixed_amount ?? 0)),
        };
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(FinanceArticle::class, 'finance_article_id');
    }
}
