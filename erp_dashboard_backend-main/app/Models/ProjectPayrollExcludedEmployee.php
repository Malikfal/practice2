<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Исключение часов сотрудника из расчёта зарплаты по конкретному проекту.
 *
 * @property string $project_id
 * @property string $user_id
 * @property-read Project|null $project
 * @property-read User|null $user
 */
class ProjectPayrollExcludedEmployee extends Pivot
{
    protected $table = 'project_payroll_excluded_employees';

    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'project_id',
        'user_id',
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
