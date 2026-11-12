<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * Накопленные показатели менеджера за один расчетный период (неделя в пределах месяца).
 *
 * Строка без проекта хранит все начисления менеджеру за период. Строка с проектом хранит
 * часы и расходы проекта за время, пока менеджер был его PM, и долю начисления менеджера,
 * распределенную по часам под контролем. Часы и начисления, исключенные из оплаты
 * настройкой проекта, не учитываются.
 *
 * @property string $id
 * @property string $company_id
 * @property Carbon $period_from
 * @property Carbon $period_to
 * @property Carbon $week_start
 * @property string $manager_id
 * @property string|null $project_id
 * @property int $developer_seconds Время разработчиков проекта (роли "Сотрудник" и "Тимлид"), кроме его PM.
 * @property int $team_seconds Время всех участников проекта, кроме его PM.
 * @property int $own_seconds Собственное время менеджера на проекте.
 * @property int $supervised_seconds Часы под контролем по правилам начисления PM.
 * @property int $developer_cost Начисления разработчикам проекта, кроме PM, в копейках.
 * @property int $team_cost Начисления всем участникам проекта, кроме PM, в копейках.
 * @property int $controlled_cost Часть team_cost, которая приходится на менеджера по настройке начисления PM.
 * @property int $manager_cost Начисления менеджеру в копейках.
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read User|null $manager
 * @property-read Project|null $project
 */
class ManagerReportStat extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'company_id',
        'period_from',
        'period_to',
        'week_start',
        'manager_id',
        'project_id',
        'developer_seconds',
        'team_seconds',
        'own_seconds',
        'supervised_seconds',
        'developer_cost',
        'team_cost',
        'controlled_cost',
        'manager_cost',
    ];

    protected $casts = [
        'period_from' => 'date',
        'period_to' => 'date',
        'week_start' => 'date',
        'developer_seconds' => 'integer',
        'team_seconds' => 'integer',
        'own_seconds' => 'integer',
        'supervised_seconds' => 'integer',
        'developer_cost' => 'integer',
        'team_cost' => 'integer',
        'controlled_cost' => 'integer',
        'manager_cost' => 'integer',
    ];

    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id')->withBlocked();
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
