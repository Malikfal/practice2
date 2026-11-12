<?php

namespace App\Models;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionPeriod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceType;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Финансовая статья и настройки распределения операций по ней.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property FinanceType $type
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string|null $parent_id
 * @property FinanceArticleDistributionMethod $distribution_method
 * @property FinanceDistributionPeriod $default_distribution_period
 * @property FinanceDistributionProjectMode $default_distribution_project_mode
 * @property array<string, mixed>|null $default_distribution_project_ids
 * @property-read Company|null $company
 * @property-read FinanceArticle|null $parent
 * @property-read Collection<int, FinanceArticle> $children
 * @property-read Collection<int, FinanceArticle> $childrenRecursive
 * @property-read Collection<int, Finance> $finances
 * @property-read Collection<int, PlannedExpense> $plannedExpenses
 */
class FinanceArticle extends Model
{
    protected $table = 'finance_article';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'parent_id',
        'name',
        'type',
        'distribution_method',
        'default_distribution_period',
        'default_distribution_project_mode',
        'default_distribution_project_ids',
    ];

    protected function casts(): array
    {
        return [
            'type' => FinanceType::class,
            'distribution_method' => FinanceArticleDistributionMethod::class,
            'default_distribution_period' => FinanceDistributionPeriod::class,
            'default_distribution_project_mode' => FinanceDistributionProjectMode::class,
            'default_distribution_project_ids' => 'array',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('name');
    }

    public function childrenRecursive(): HasMany
    {
        return $this->children()->with('childrenRecursive');
    }

    public function finances(): HasMany
    {
        return $this->hasMany(Finance::class, 'finance_article_id');
    }

    public function plannedExpenses(): HasMany
    {
        return $this->hasMany(PlannedExpense::class, 'finance_article_id');
    }
}
