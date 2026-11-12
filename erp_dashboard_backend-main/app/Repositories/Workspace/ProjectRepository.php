<?php

namespace App\Repositories\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Support\CurrentWeek;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ProjectRepository
{
    private const SEGMENT_DURATION_SQL = '(seg.ended_at - seg.started_at)';

    public function __construct(
        private readonly ProjectAssignmentHistoryRepository $assignmentHistoryRepo,
    ) {}

    public function paginate(string $companyId, array $filters): LengthAwarePaginator|Collection
    {
        return $this->getOrPaginate(
            $this->applyFilters(Project::query(), $companyId, $filters),
            $filters,
        );
    }

    public function paginateForUser(User $user, array $filters): LengthAwarePaginator|Collection
    {
        return $this->getOrPaginate(
            $this->applyFilters(Project::query(), (string) $user->company_id, $filters)
                ->whereHas('members', fn ($query) => $query->where('user_id', $user->id)),
            $filters,
        );
    }

    public function allForUser(User $user, string $status, string $search): Collection
    {
        return $this->applyFilters(Project::query(), (string) $user->company_id, [
            'status' => $status,
            'search' => $search,
        ])
            ->whereHas('members', fn (Builder $query) => $query->where('user_id', $user->id))
            ->get();
    }

    private function applyFilters(
        Builder $query,
        string $companyId,
        array $filters,
    ): Builder {
        $status = $filters['status'] ?? 'all';
        $search = trim((string) ($filters['search'] ?? ''));
        $sortBy = $filters['sort_by'] ?? null;
        $sortDirection = $filters['sort_direction'] ?? 'asc';

        $query
            ->select('projects.*')
            ->with(['client', 'members.user', 'payrollExcludedEmployees', 'tags', 'company'])
            ->where('company_id', $companyId)
            ->when($status === 'active', fn (Builder $query) => $query->where('status', ProjectStatus::ACTIVE->value))
            ->when($status === 'archived', fn (Builder $query) => $query->where('status', ProjectStatus::ARCHIVED->value))
            ->when($search !== '', fn (Builder $query) => $query->whereRaw(
                'LOWER(name) LIKE ?',
                ['%'.mb_strtolower($search).'%'],
            ));

        if ($sortBy !== null) {
            return $this->applySorting($query, $companyId, $sortBy, $sortDirection);
        }

        return $query
            ->orderByRaw(
                'CASE WHEN status = ? THEN 0 WHEN status = ? THEN 1 ELSE 2 END',
                [ProjectStatus::ACTIVE->value, ProjectStatus::ARCHIVED->value],
            )
            ->orderBy('name');
    }

    private function applySorting(Builder $query, string $companyId, string $sortBy, string $sortDirection): Builder
    {
        if ($sortBy === 'client') {
            $query->addSelect([
                'client_sort_name' => DB::table('clients')
                    ->selectRaw('LOWER(clients.name)')
                    ->whereColumn('clients.id', 'projects.client_id')
                    ->limit(1),
            ]);

            return $query
                ->orderByRaw("client_sort_name {$sortDirection} NULLS LAST")
                ->orderBy('projects.id');
        }

        if ($sortBy === 'manager') {
            $query->addSelect([
                'manager_sort_name' => DB::table('project_members as pm')
                    ->join('users as manager', 'manager.id', '=', 'pm.user_id')
                    ->selectRaw("LOWER(CONCAT_WS(' ', manager.name, manager.last_name))")
                    ->whereColumn('pm.project_id', 'projects.id')
                    ->where('pm.is_pm', true)
                    ->orderByRaw("LOWER(CONCAT_WS(' ', manager.name, manager.last_name))")
                    ->limit(1),
            ]);

            return $query
                ->orderByRaw("manager_sort_name {$sortDirection} NULLS LAST")
                ->orderBy('projects.id');
        }

        if ($sortBy === 'entrance_article') {
            $query->addSelect([
                'entrance_article_sort_name' => DB::table('finance_article')
                    ->selectRaw('LOWER(finance_article.name)')
                    ->whereColumn('finance_article.id', 'projects.default_entrance_finance_article_id')
                    ->limit(1),
            ]);

            return $query
                ->orderByRaw("entrance_article_sort_name {$sortDirection} NULLS LAST")
                ->orderBy('projects.id');
        }

        // Поля действующей на сегодня ставки проекта.
        $rateColumns = ['rate_effective_from' => 'effective_from', 'rate' => 'rate', 'vat' => 'vat'];
        if (array_key_exists($sortBy, $rateColumns)) {
            $query->addSelect([
                'rate_sort_value' => DB::table('project_rates')
                    ->select("project_rates.{$rateColumns[$sortBy]}")
                    ->whereColumn('project_rates.project_id', 'projects.id')
                    ->whereDate('project_rates.effective_from', '<=', Company::todayFor($companyId))
                    ->orderByDesc('project_rates.effective_from')
                    ->orderByDesc('project_rates.created_at')
                    ->limit(1),
            ]);

            return $query
                ->orderByRaw("rate_sort_value {$sortDirection} NULLS LAST")
                ->orderBy('projects.id');
        }

        if ($sortBy === 'weekly_seconds') {
            [$weekFrom, $weekTo] = CurrentWeek::bounds($companyId);
            $from = $weekFrom->timestamp;
            $to = $weekTo->timestamp;

            $query->addSelect([
                'weekly_seconds_sort' => DB::table('work_segments as seg')
                    ->join('tasks as task', 'task.id', '=', 'seg.task_id')
                    ->selectRaw(
                        'COALESCE(SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)), 0)',
                        [$to, $from],
                    )
                    ->whereColumn('task.project_id', 'projects.id')
                    ->where('seg.started_at', '<', $to)
                    ->where('seg.ended_at', '>', $from),
            ]);

            return $query
                ->orderBy('weekly_seconds_sort', $sortDirection)
                ->orderBy('projects.id');
        }

        if ($sortBy === 'total_seconds') {
            $query->addSelect([
                'total_seconds_sort' => DB::table('work_segments as seg')
                    ->join('tasks as task', 'task.id', '=', 'seg.task_id')
                    ->selectRaw('COALESCE(SUM(seg.ended_at - seg.started_at), 0)')
                    ->whereColumn('task.project_id', 'projects.id'),
            ]);

            return $query
                ->orderBy('total_seconds_sort', $sortDirection)
                ->orderBy('projects.id');
        }

        return $query
            ->orderBy("projects.{$sortBy}", $sortDirection)
            ->orderBy('projects.id');
    }

    private function getOrPaginate(Builder $query, array $filters): LengthAwarePaginator|Collection
    {
        if (! array_key_exists('page', $filters) && ! array_key_exists('per_page', $filters)) {
            return $query->get();
        }

        return $query
            ->paginate((int) ($filters['per_page'] ?? 20))
            ->withQueryString();
    }

    public function create(array $attributes): Project
    {
        $project = Project::create($attributes);

        return $project->load(['client', 'members.user', 'payrollExcludedEmployees', 'tags', 'taskStatusColumns', 'company']);
    }

    public function update(Project $project, array $attributes): Project
    {
        $project->update($attributes);

        return $project->fresh()->load(['client', 'members.user', 'payrollExcludedEmployees', 'tags', 'taskStatusColumns', 'company']);
    }

    public function loadWithMembers(Project $project): Project
    {
        return $project->load(['client', 'members.user', 'payrollExcludedEmployees', 'tags', 'taskStatusColumns', 'company']);
    }

    /** Сохраняет сотрудников, чьи часы исключаются из payroll для проекта. */
    public function syncPayrollExcludedEmployees(Project $project, array $employeeIds): void
    {
        $project->payrollExcludedEmployees()->sync($employeeIds);
    }

    public function totalSeconds(Project $project): int
    {
        return (int) DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->where('t.project_id', $project->id)
            ->selectRaw('COALESCE(SUM('.self::SEGMENT_DURATION_SQL.'), 0) as total_seconds')
            ->value('total_seconds');
    }

    public function durationByEmployee(Project $project): Collection
    {
        return DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->where('t.project_id', $project->id)
            ->groupBy('u.id', 'u.name')
            ->orderBy('u.name')
            ->selectRaw(
                'u.id as user_id, u.name as user_name, SUM('.self::SEGMENT_DURATION_SQL.') as duration_seconds'
            )
            ->get();
    }

    public function addMember(
        Project $project,
        User $employee,
        string $memberId,
        bool $isPm = false,
        bool $isPmPayrollEnabled = true,
    ): Project {
        DB::transaction(function () use ($project, $employee, $memberId, $isPm, $isPmPayrollEnabled): void {
            $member = ProjectMember::query()
                ->where('project_id', $project->id)
                ->where('user_id', $employee->id)
                ->lockForUpdate()
                ->first() ?? new ProjectMember([
                    'id' => $memberId,
                    'project_id' => $project->id,
                    'user_id' => $employee->id,
                ]);

            $member->fill([
                'is_pm' => $isPm,
                'is_pm_payroll_enabled' => $isPm && $isPmPayrollEnabled,
            ])->save();

            $this->assignmentHistoryRepo->sync($member);
        });

        return $project->fresh()->load(['client', 'members.user', 'tags', 'taskStatusColumns', 'company']);
    }

    public function removeMember(Project $project, User $employee): Project
    {
        DB::transaction(function () use ($project, $employee): void {
            /** @var ProjectMember|null $member */
            $member = ProjectMember::query()
                ->where('project_id', $project->id)
                ->where('user_id', $employee->id)
                ->lockForUpdate()
                ->first();

            if (! $member) {
                return;
            }

            $this->assignmentHistoryRepo->close($member);
            $member->delete();
        });

        return $project->fresh()->load(['client', 'members.user', 'tags', 'taskStatusColumns', 'company']);
    }

    public function delete(Project $project): void
    {
        $project->delete();
    }

    public function userHasAccessToProject(User $user, Project $project): bool
    {
        return $user->isAssignedToProject($project);
    }
}
