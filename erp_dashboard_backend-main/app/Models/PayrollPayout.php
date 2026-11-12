<?php

namespace App\Models;

use App\Enums\PayrollPayoutKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;

/**
 * Фактическая выплата сотруднику по ведомости за месяц.
 *
 * @property string $id
 * @property string $company_id
 * @property string $employee_id
 * @property string $period_month Месяц ведомости в формате ГГГГ-ММ
 * @property PayrollPayoutKind $kind
 * @property int $amount
 * @property Carbon $paid_at
 * @property string $payroll_payout_article_id
 * @property string|null $comment
 * @property string|null $created_by
 * @property string|null $deleted_by
 * @property-read User|null $employee
 * @property-read User|null $creator
 * @property-read PayrollPayoutArticle|null $article
 */
class PayrollPayout extends Model
{
    use SoftDeletes;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_id',
        'period_month',
        'kind',
        'amount',
        'paid_at',
        'payroll_payout_article_id',
        'comment',
        'created_by',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'kind' => PayrollPayoutKind::class,
            'amount' => 'integer',
            'paid_at' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id')->withBlocked();
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by')->withBlocked();
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(PayrollPayoutArticle::class, 'payroll_payout_article_id');
    }
}
