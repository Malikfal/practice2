<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Файл, прикреплённый к сообщению для клиента.
 *
 * @property string $id
 * @property string $message_id
 * @property string $task_id
 * @property string $path
 * @property string $original_name
 * @property string|null $mime_type
 * @property string|null $uploaded_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read TaskClientMessage|null $message
 * @property-read Task|null $task
 * @property-read User|null $uploader
 */
class TaskClientMessageAttachment extends Model
{
    use HasUuids;

    protected $fillable = [
        'id',
        'message_id',
        'task_id',
        'path',
        'original_name',
        'mime_type',
        'uploaded_by',
    ];

    public function message(): BelongsTo
    {
        return $this->belongsTo(TaskClientMessage::class, 'message_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
