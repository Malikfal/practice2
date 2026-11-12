<?php

namespace App\Models;

use App\Enums\InvoiceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Счёт на оплату, выставленный компании.
 *
 * @property string $id
 * @property string $company_id
 * @property string $tariff_id
 * @property string $number
 * @property int $amount
 * @property int $period_days
 * @property InvoiceStatus $status
 * @property Carbon|null $paid_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $ends_at
 * @property string|null $comment
 * @property-read Company|null $company
 * @property-read Tariff|null $tariff
 */
class Invoice extends Model
{
    use HasUuids;

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'tariff_id',
        'number',
        'amount',
        'period_days',
        'status',
        'paid_at',
        'ends_at',
        'comment',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
            'ends_at' => 'datetime',
            'status' => InvoiceStatus::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function tariff(): BelongsTo
    {
        return $this->belongsTo(Tariff::class);
    }

    // Вспомогательные методы
    public function isPaid(): bool
    {
        return $this->status === InvoiceStatus::PAID;
    }

    public function markAsPaid(): void
    {
        $this->update([
            'status' => InvoiceStatus::PAID,
            'paid_at' => now(),
        ]);
    }
}
