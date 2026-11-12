<?php

namespace App\Models;

use App\Enums\ProjectManagerPaymentMethod;
use App\Enums\ProjectPayrollExclusionScope;
use App\Enums\ProjectStatus;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Проект компании с участниками, задачами и финансовыми настройками.
 *
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property string $name
 * @property string|null $description
 * @property string $id
 * @property string $created_by_id
 * @property ProjectStatus $status
 * @property string|null $company_id
 * @property string|null $client_id
 * @property string|null $default_entrance_finance_article_id
 * @property Carbon|null $starts_at
 * @property Carbon|null $ends_at
 * @property int|null $budget
 * @property ProjectManagerPaymentMethod $manager_payment_method
 * @property bool $is_internal
 * @property bool $exclude_from_payroll
 * @property ProjectPayrollExclusionScope $payroll_exclusion_scope
 * @property int|null $weekly_limit_seconds Недельный лимит проекта, не действует при лимите клиента.
 * @property-read Company|null $company
 * @property-read User|null $createdBy
 * @property-read Client|null $client
 * @property-read FinanceArticle|null $defaultEntranceFinanceArticle
 * @property-read Collection<int, Task> $tasks
 * @property-read Collection<int, ProjectMember> $members
 * @property-read Collection<int, ProjectActivityHistory> $activityHistories
 * @property-read ProjectActivityHistory|null $latestActivityHistory
 * @property-read ProjectMember|null $managerMember
 * @property-read Collection<int, User> $users
 * @property-read Collection<int, User> $payrollExcludedEmployees
 * @property-read Collection<int, ProjectPayrollExcludedEmployee> $payrollExclusions
 * @property-read Collection<int, WorkSession> $workSessions
 * @property-read Collection<int, Tag> $tags
 * @property-read Collection<int, TaskStatusColumn> $taskStatusColumns
 */
class Project extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'description',
        'status',
        'created_by_id',
        'company_id',
        'client_id',
        'default_entrance_finance_article_id',
        'starts_at',
        'ends_at',
        'budget',
        'manager_payment_method',
        'is_internal',
        'exclude_from_payroll',
        'payroll_exclusion_scope',
        'weekly_limit_seconds',
    ];

    protected function casts(): array
    {
        return [
            'status' => ProjectStatus::class,
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'budget' => 'integer',
            'manager_payment_method' => ProjectManagerPaymentMethod::class,
            'is_internal' => 'boolean',
            'exclude_from_payroll' => 'boolean',
            'payroll_exclusion_scope' => ProjectPayrollExclusionScope::class,
            'weekly_limit_seconds' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Company, Project>
     */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'client_id');
    }

    public function defaultEntranceFinanceArticle(): BelongsTo
    {
        return $this->belongsTo(FinanceArticle::class, 'default_entrance_finance_article_id');
    }

    public function resolveRouteBinding($value, $field = null): ?self
    {
        $project = $this->where($field ?? $this->getRouteKeyName(), $value)->firstOrFail();
        $actor = auth()->user();

        if ($actor && ! $actor->isSuperAdmin() && (string) $actor->company_id !== (string) $project->company_id) {
            abort(404);
        }

        return $project;
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(ProjectMember::class);
    }

    public function assignmentHistories(): HasMany
    {
        return $this->hasMany(ProjectAssignmentHistory::class);
    }

    /** @return HasMany<ProjectActivityHistory, Project> */
    public function activityHistories(): HasMany
    {
        return $this->hasMany(ProjectActivityHistory::class);
    }

    /** @return HasOne<ProjectActivityHistory, Project> */
    public function latestActivityHistory(): HasOne
    {
        return $this->hasOne(ProjectActivityHistory::class)
            ->orderByDesc('started_on')
            ->orderByDesc('created_at');
    }

    public function managerMember(): HasOne
    {
        return $this->hasOne(ProjectMember::class)->where('is_pm', true);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_members');
    }

    public function payrollExcludedEmployees(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_payroll_excluded_employees')
            ->using(ProjectPayrollExcludedEmployee::class)
            ->withBlocked();
    }

    public function payrollExclusions(): HasMany
    {
        return $this->hasMany(ProjectPayrollExcludedEmployee::class);
    }

    public function workSessions(): HasMany
    {
        return $this->hasMany(WorkSession::class);
    }

    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class, 'project_tags')->withTimestamps();
    }

    public function taskStatusColumns(): HasMany
    {
        return $this->hasMany(TaskStatusColumn::class)->orderBy('position');
    }
}
