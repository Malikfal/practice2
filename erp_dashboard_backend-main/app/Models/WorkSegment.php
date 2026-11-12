<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Учтённый интервал работы над задачей.
 *
 * @property string $id
 * @property int $started_at
 * @property int $ended_at
 * @property string $task_id
 * @property string $user_id
 * @property string|null $note
 * @property string|null $created_by
 * @property-read Task|null $task
 * @property-read User|null $user
 */
class WorkSegment extends Model
{
    protected $table = 'work_segments';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'task_id',
        'user_id',
        'started_at',
        'ended_at',
        'note',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'integer',
            'ended_at' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withBlocked();
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $segment = $this->with(['task.project', 'user'])
            ->where($field ?? $this->getRouteKeyName(), $value)
            ->firstOrFail();
        $actor = auth()->user();

        if ($actor && ! $actor->isSuperAdmin()) {
            $companyId = (string) $actor->company_id;

            if (
                $companyId !== (string) $segment->user?->company_id
                || $companyId !== (string) $segment->task?->project?->company_id
            ) {
                abort(404);
            }
        }

        return $segment;
    }
}
