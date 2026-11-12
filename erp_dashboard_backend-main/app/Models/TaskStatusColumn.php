<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Колонка рабочего процесса на доске задач проекта.
 *
 * @property string $id
 * @property string $company_id
 * @property string $project_id
 * @property string $name
 * @property string $slug
 * @property string|null $color
 * @property int $position
 * @property bool $is_final
 * @property bool $is_default
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Company|null $company
 * @property-read Project|null $project
 * @property-read Collection<int, Task> $tasks
 */
class TaskStatusColumn extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'project_id',
        'name',
        'slug',
        'color',
        'position',
        'is_default',
        'is_final',
    ];

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'is_default' => 'boolean',
            'is_final' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class, 'project_id');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class, 'task_status_column_id');
    }
}
