<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Участие сотрудника в проекте.
 * Если будет изменяться эта модель, то нужно будет поменять и ProjectAssignmentHistory.
 *
 * @property string $id
 * @property string $project_id
 * @property string $user_id
 * @property bool $is_pm
 * @property bool $is_pm_payroll_enabled
 * @property-read Project|null $project
 * @property-read User|null $user
 */
class ProjectMember extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'project_id',
        'user_id',
        'is_pm',
        'is_pm_payroll_enabled',
    ];

    protected $casts = [
        'is_pm' => 'boolean',
        'is_pm_payroll_enabled' => 'boolean',
    ];

    /**
     * @return BelongsTo<Project, ProjectMember>
     */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * @return BelongsTo<User, ProjectMember>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class)->withBlocked();
    }
}
