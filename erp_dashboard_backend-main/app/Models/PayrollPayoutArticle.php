<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Статья выплаты ФОТ: основание, которое выбирают при выплате сотруднику.
 *
 * @property string $id
 * @property string $company_id
 * @property string $name
 * @property Carbon|null $archived_at
 */
class PayrollPayoutArticle extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'name',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'archived_at' => 'datetime',
        ];
    }

    public function payouts(): HasMany
    {
        return $this->hasMany(PayrollPayout::class, 'payroll_payout_article_id');
    }
}
