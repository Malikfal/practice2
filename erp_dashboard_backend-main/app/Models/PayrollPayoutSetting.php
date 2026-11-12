<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Настройки учета выплат ФОТ компании.
 *
 * @property string $id
 * @property string $company_id
 * @property string $start_month Месяц начала учета в формате ГГГГ-ММ
 */
class PayrollPayoutSetting extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'start_month',
    ];
}
