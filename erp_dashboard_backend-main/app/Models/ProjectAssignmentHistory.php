<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Исторический период участия сотрудника в проекте. 
 *
 * @property string $id
 * @property string $project_id
 * @property string $user_id
 * @property bool $is_pm
 * @property bool $is_pm_payroll_enabled
 * @property Carbon $started_on
 * @property Carbon|null $ended_on
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Project|null $project
 * @property-read User|null $user
 */
class ProjectAssignmentHistory extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'project_id',
        'user_id',
        'is_pm',
        'is_pm_payroll_enabled',
        'started_on',
        'ended_on',
    ];

    protected $casts = [
        'is_pm' => 'boolean',
        'is_pm_payroll_enabled' => 'boolean',
        'started_on' => 'date',
        'ended_on' => 'date',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withBlocked();
    }
}
