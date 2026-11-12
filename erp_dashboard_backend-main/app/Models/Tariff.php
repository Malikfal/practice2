<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Доступный тариф подписки.
 *
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property int|null $max_employees
 * @property bool $is_active
 * @property int $price
 * @property bool $is_public
 * @property string $plan free или pro
 * @property-read Collection<int, Company> $companies
 */
class Tariff extends Model
{
    use HasUuids;

    public $incrementing = false;

    public $timestamps = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'slug',
        'max_employees',
        'is_active',
        'price',
        'is_public',
        'plan',
    ];

    public const PLAN_FREE = 'free';

    public const PLAN_PRO = 'pro';

    public function isFree(): bool
    {
        return $this->plan === self::PLAN_FREE;
    }

    public static function free(): ?self
    {
        return self::query()->where('plan', self::PLAN_FREE)->where('is_active', true)->orderBy('price')->first();
    }

    // Оставлю на будущее, да бы можно было получить все компании на определенном тарифе
    public function companies(): HasMany
    {
        return $this->hasMany(Company::class);
    }
}
