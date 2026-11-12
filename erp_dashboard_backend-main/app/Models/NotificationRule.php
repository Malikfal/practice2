<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Настройка компании: присылать ли событие пользователям с этой связью с задачей.
 * Хранятся только отличия от значений по умолчанию из NotificationEvent.
 *
 * @property int $id
 * @property string $company_id
 * @property string $event
 * @property string $relation
 * @property bool $enabled
 */
class NotificationRule extends Model
{
    protected $fillable = [
        'company_id',
        'event',
        'relation',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
        ];
    }
}
