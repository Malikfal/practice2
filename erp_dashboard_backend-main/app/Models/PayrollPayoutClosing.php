<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Зафиксированный месяц ведомости выплат ФОТ.
 *
 * Пока запись есть, суммы аванса и расчета за месяц не меняются: перерасчет начислений
 * уходит переносом на следующий месяц.
 *
 * @property string $id
 * @property string $company_id
 * @property string $period_month Месяц ведомости в формате ГГГГ-ММ
 * @property string|null $closed_by
 * @property Carbon|null $created_at
 */
class PayrollPayoutClosing extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'period_month',
        'closed_by',
    ];

    public function closer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'closed_by')->withBlocked();
    }
}
