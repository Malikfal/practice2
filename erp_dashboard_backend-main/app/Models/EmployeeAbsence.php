<?php

namespace App\Models;

use App\Enums\EmployeeAbsencePaymentMode;
use App\Enums\EmployeeAbsenceType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Период отсутствия сотрудника и настройки его оплаты.
 *
 * @property string $id
 * @property string $company_id
 * @property string $employee_id
 * @property EmployeeAbsenceType $type
 * @property Carbon $date_from
 * @property Carbon $date_to
 * @property EmployeeAbsencePaymentMode $payment_mode
 * @property int|null $fixed_daily_amount
 * @property string|null $comment
 * @property string $created_by
 * @property string|null $updated_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property string $coefficient
 * @property array<string, mixed>|null $project_distribution
 * @property-read Company|null $company
 * @property-read User|null $employee
 * @property-read User|null $creator
 * @property-read User|null $updater
 */
class EmployeeAbsence extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'employee_id',
        'type',
        'date_from',
        'date_to',
        'payment_mode',
        'fixed_daily_amount',
        'coefficient',
        'comment',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => EmployeeAbsenceType::class,
            'date_from' => 'date',
            'date_to' => 'date',
            'payment_mode' => EmployeeAbsencePaymentMode::class,
            'fixed_daily_amount' => 'integer',
            'coefficient' => 'decimal:4',
        ];
    }

    public function calculatedFixedDailyAmount(): ?int
    {
        if ($this->fixed_daily_amount === null) {
            return null;
        }

        return (int) round(
            $this->fixed_daily_amount * (float) ($this->coefficient ?? 1),
            mode: PHP_ROUND_HALF_UP,
        );
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
