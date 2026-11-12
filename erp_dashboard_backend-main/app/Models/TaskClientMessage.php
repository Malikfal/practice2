<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Сообщение для клиента в обсуждении задачи.
 *
 * @property string $id
 * @property string $task_id
 * @property string|null $author_id
 * @property string|null $text
 * @property bool $is_from_client
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Task|null $task
 * @property-read User|null $author
 * @property-read Collection<int, TaskClientMessageAttachment> $attachments
 */
class TaskClientMessage extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'task_id',
        'author_id',
        'text',
        'is_from_client',
    ];

    protected function casts(): array
    {
        return [
            'is_from_client' => 'boolean',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskClientMessageAttachment::class, 'message_id');
    }
}
