<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Личные настройки уведомлений. Если строки нет, всё включено и автоподписка работает.
 *
 * @property string $user_id
 * @property array<int, string> $disabled_events
 * @property bool $auto_watch
 */
class UserNotificationSetting extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'user_id';

    protected $keyType = 'string';

    protected $fillable = [
        'user_id',
        'disabled_events',
        'auto_watch',
    ];

    protected function casts(): array
    {
        return [
            'disabled_events' => 'array',
            'auto_watch' => 'boolean',
        ];
    }
}
