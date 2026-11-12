<?php

namespace App\Models;

use App\Enums\PayrollHoursScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Ставка оплаты сотрудника, действующая в заданном периоде.
 *
 * @property string $id
 * @property string $employee_id
 * @property int|null $salary
 * @property int|null $hourly_rate
 * @property int|null $supervised_hourly_rate
 * @property Carbon $effective_from
 * @property string $changed_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property int|null $company_hourly_rate
 * @property bool $exclude_from_supervised_hours
 * @property array<string, mixed>|null $rate_settings
 * @property PayrollHoursScope $salary_distribution_scope
 * @property-read User|null $employee
 * @property-read User|null $changer
 */
class EmployeeRate extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'employee_id',
        'salary',
        'salary_distribution_scope',
        'hourly_rate',
        'supervised_hourly_rate',
        'company_hourly_rate',
        'exclude_from_supervised_hours',
        'rate_settings',
        'effective_from',
        'changed_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'salary' => 'integer',
        'salary_distribution_scope' => PayrollHoursScope::class,
        'hourly_rate' => 'integer',
        'supervised_hourly_rate' => 'integer',
        'company_hourly_rate' => 'integer',
        'exclude_from_supervised_hours' => 'boolean',
        'rate_settings' => 'array',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id')->withBlocked();
    }

    public function changer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
