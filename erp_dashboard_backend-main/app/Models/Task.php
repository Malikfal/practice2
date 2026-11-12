<?php

namespace App\Models;

use App\Enums\TaskPriority;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Задача проекта и её состояние в рабочем процессе.
 *
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property string $title
 * @property string $id
 * @property string $project_id
 * @property string $status
 * @property float $position
 * @property string|null $description
 * @property array<string, mixed>|null $description_delta
 * @property TaskPriority|null $priority
 * @property int|null $estimation
 * @property string|null $task_status_column_id
 * @property string|null $created_by_id
 * @property string|null $parent_task_id
 * @property Carbon|null $deadline
 * @property Carbon|null $start_at
 * @property Carbon|null $last_activity_at
 * @property string|null $last_activity_by_id
 * @property bool $is_draft
 * @property Carbon|null $published_at
 * @property string|null $client_approval_status
 * @property int|null $spent_seconds
 * @property-read int|null $remaining_seconds
 * @property-read Project|null $project
 * @property-read Task|null $parentTask
 * @property-read Collection<int, Task> $subtasks
 * @property-read User|null $creator
 * @property-read Collection<int, User> $assignees
 * @property-read Collection<int, WorkSegment> $workSegments
 * @property-read Collection<int, TaskComment> $comments
 * @property-read Collection<int, TaskAttachment> $attachments
 * @property-read Collection<int, TaskPublicLink> $publicLinks
 * @property-read Collection<int, TaskClientMessage> $clientMessages
 * @property-read TaskStatusColumn|null $statusColumn
 */
class Task extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'title',
        'project_id',
        'parent_task_id',
        'created_by_id',
        'is_draft',
        'published_at',
        'status',
        'task_status_column_id',
        'position',
        'description',
        'description_delta',
        'priority',
        'estimation',
        'deadline',
        'start_at',
        'client_approval_status',
        'is_client_visible',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'float',
            'number' => 'integer',
            'is_draft' => 'boolean',
            'published_at' => 'datetime',
            'description_delta' => 'array',
            'priority' => TaskPriority::class,
            'estimation' => 'integer',
            'deadline' => 'datetime',
            'start_at' => 'datetime',
            'last_activity_at' => 'datetime',
            'is_client_visible' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function parentTask(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_task_id');
    }

    public function subtasks(): HasMany
    {
        return $this->hasMany(self::class, 'parent_task_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function assignees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'task_users');
    }

    public function workSegments(): HasMany
    {
        return $this->hasMany(WorkSegment::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(TaskComment::class);
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TaskAttachment::class);
    }

    public function publicLinks(): HasMany
    {
        return $this->hasMany(TaskPublicLink::class);
    }

    public function clientMessages(): HasMany
    {
        return $this->hasMany(TaskClientMessage::class);
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $task = $this->with('project')
            ->where($field ?? $this->getRouteKeyName(), $value)
            ->firstOrFail();
        $actor = auth()->user();

        if ($actor && ! $actor->isSuperAdmin() && (string) $actor->company_id !== (string) $task->project?->company_id) {
            abort(404);
        }

        return $task;
    }

    public function statusColumn(): BelongsTo
    {
        return $this->belongsTo(TaskStatusColumn::class, 'task_status_column_id');
    }

    public function getRemainingSecondsAttribute(): ?int
    {
        if ($this->estimation === null) {
            return null;
        }

        return (int) $this->estimation - (int) ($this->spent_seconds ?? 0);
    }
}
