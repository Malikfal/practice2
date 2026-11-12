<?php

namespace App\Models;

use App\Enums\PayrollRecalculationStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Состояние перерасчёта заработной платы за период.
 *
 * @property string $id
 * @property string $company_id
 * @property string|null $requested_by
 * @property Carbon $period_from
 * @property PayrollRecalculationStatus $status
 * @property string|null $error_message
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $period_to
 * @property-read Company|null $company
 * @property-read User|null $requester
 */
class PayrollRecalculation extends Model
{
    protected $table = 'payroll_recalculations';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'requested_by',
        'period_from',
        'period_to',
        'status',
        'error_message',
        'started_at',
        'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'period_from' => 'date',
            'period_to' => 'date',
            'status' => PayrollRecalculationStatus::class,
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
