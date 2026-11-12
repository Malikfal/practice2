<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * Заявка пользователя на подключение к сервису.
 *
 * @property string $id
 * @property string $name
 * @property string $phone
 * @property string|null $tariff
 * @property bool $personal_data_consent
 * @property string $status
 * @property string|null $ip
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property bool $marketing_consent
 */
class Application extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'phone',
        'tariff',
        'personal_data_consent',
        'marketing_consent',
        'status',
        'ip',
    ];

    protected $casts = [
        'personal_data_consent' => 'boolean',
        'marketing_consent' => 'boolean',
    ];
}
