<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Остаток задолженности перед сотрудником на месяц начала учета выплат.
 *
 * @property string $id
 * @property string $company_id
 * @property string $employee_id
 * @property int $amount Плюс - долг компании, минус - переплата
 */
class PayrollPayoutOpening extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_id',
        'amount',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
        ];
    }
}
