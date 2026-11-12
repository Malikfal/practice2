<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Зафиксированные суммы аванса и расчета сотрудника за месяц.
 *
 * Пустая сумма означает, что она считается по начислениям. Сумма фиксируется ручной правкой,
 * после полной выплаты или фиксацией месяца, чтобы поздний перерасчет не менял ведомость.
 *
 * @property string $id
 * @property string $company_id
 * @property string $employee_id
 * @property string $period_month Месяц ведомости в формате ГГГГ-ММ
 * @property int|null $advance_amount
 * @property bool $advance_is_manual
 * @property int|null $settlement_amount
 * @property bool $settlement_is_manual
 */
class PayrollPayoutPlan extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_id',
        'period_month',
        'advance_amount',
        'advance_is_manual',
        'settlement_amount',
        'settlement_is_manual',
    ];

    protected function casts(): array
    {
        return [
            'advance_amount' => 'integer',
            'advance_is_manual' => 'boolean',
            'settlement_amount' => 'integer',
            'settlement_is_manual' => 'boolean',
        ];
    }
}
