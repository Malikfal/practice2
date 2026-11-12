<?php

namespace App\Models;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceDistributionProjectMode;
use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Операция дохода или расхода.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $project_id
 * @property string|null $finance_article_id
 * @property string|null $employee_id
 * @property int $amount
 * @property FinanceType $type
 * @property string|null $comment
 * @property Carbon $dateOfPayment
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property FinanceSource $source
 * @property Carbon|null $distribution_from
 * @property Carbon|null $distribution_to
 * @property FinanceDistributionProjectMode|null $distribution_project_mode
 * @property array<string, mixed>|null $distribution_project_ids
 * @property FinanceArticleDistributionMethod|null $distribution_method
 * @property-read Company|null $company
 * @property-read Project|null $project
 * @property-read FinanceArticle|null $article
 * @property-read User|null $employee
 */
class Finance extends Model
{
    protected $table = 'finance';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'project_id',
        'finance_article_id',
        'employee_id',
        'amount',
        'type',
        'source',
        'comment',
        'dateOfPayment',
        'distribution_from',
        'distribution_to',
        'distribution_method',
        'distribution_project_mode',
        'distribution_project_ids',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'type' => FinanceType::class,
            'source' => FinanceSource::class,
            'dateOfPayment' => 'date',
            'distribution_from' => 'date',
            'distribution_to' => 'date',
            'distribution_method' => FinanceArticleDistributionMethod::class,
            'distribution_project_mode' => FinanceDistributionProjectMode::class,
            'distribution_project_ids' => 'array',
        ];
    }

    /** Настройка операции важнее статьи; используется уже загруженная связь без скрытого SQL. */
    public function distributionMethod(): FinanceArticleDistributionMethod
    {
        return $this->distribution_method
            ?? ($this->getRelations()['article'] ?? null)?->distribution_method
            ?? FinanceArticleDistributionMethod::BY_TERM;
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(FinanceArticle::class, 'finance_article_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id')->withBlocked();
    }
}
