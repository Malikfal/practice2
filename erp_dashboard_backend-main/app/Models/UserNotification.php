<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Уведомление в ленте пользователя.
 *
 * @property string $id
 * @property string $company_id
 * @property string $user_id
 * @property string|null $actor_id
 * @property string $type
 * @property string|null $task_id
 * @property string|null $project_id
 * @property array<string, mixed> $data
 * @property array<int, string> $reasons
 * @property Carbon|null $read_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $user
 * @property-read User|null $actor
 * @property-read Task|null $task
 * @property-read Project|null $project
 */
class UserNotification extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'company_id',
        'user_id',
        'actor_id',
        'type',
        'task_id',
        'project_id',
        'data',
        'reasons',
        'read_at',
    ];

    protected function casts(): array
    {
        return [
            'data' => 'array',
            'reasons' => 'array',
            'read_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withBlocked();
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id')->withBlocked();
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
