<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Файл, прикреплённый к внутреннему комментарию задачи.
 *
 * @property string $id
 * @property string $comment_id
 * @property string $project_id
 * @property string $task_id
 * @property string $path
 * @property string $original_name
 * @property string|null $mime_type
 * @property string|null $uploaded_by
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read TaskComment|null $comment
 * @property-read User|null $uploader
 */
class TaskCommentAttachment extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'comment_id',
        'project_id',
        'task_id',
        'path',
        'original_name',
        'mime_type',
        'uploaded_by',
    ];

    protected function casts(): array
    {
        return [];
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(TaskComment::class, 'comment_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
