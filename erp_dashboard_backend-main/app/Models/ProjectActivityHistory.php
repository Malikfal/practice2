<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Период, в течение которого проект считался активным.
 *
 * @property string $id
 * @property string $project_id
 * @property Carbon $started_on
 * @property Carbon|null $ended_on
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Project|null $project
 */
class ProjectActivityHistory extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'project_id',
        'started_on',
        'ended_on',
    ];

    protected $casts = [
        'started_on' => 'date',
        'ended_on' => 'date',
    ];

    /** @return BelongsTo<Project, ProjectActivityHistory> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
