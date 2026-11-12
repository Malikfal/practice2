<?php

namespace App\Models;

use App\Enums\TaskSubscriptionMode;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Подписка пользователя на задачу: «Следить» или «Не уведомлять».
 * Ключ составной (task_id, user_id), поэтому строки меняются запросами, а не save().
 *
 * @property string $task_id
 * @property string $user_id
 * @property TaskSubscriptionMode $mode
 * @property string $source
 */
class TaskSubscription extends Model
{
    public const SOURCE_MANUAL = 'manual';

    public const SOURCE_AUTO = 'auto';

    public $incrementing = false;

    protected $primaryKey = null;

    protected $fillable = [
        'task_id',
        'user_id',
        'mode',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'mode' => TaskSubscriptionMode::class,
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
