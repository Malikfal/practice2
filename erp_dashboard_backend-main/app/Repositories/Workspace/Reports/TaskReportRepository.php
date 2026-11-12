<?php

namespace App\Repositories\Workspace\Reports;

use App\Models\Company;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TaskReportRepository
{
    private const CLAMPED_DURATION_SQL = '(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?))';

    public function timezoneForCompany(string $companyId): string
    {
        return Company::query()->findOrFail($companyId)->payrollTimezone();
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds
     * @param  list<string>  $clientIds
     * @return Collection<int, object>
     */
    public function build(
        string $companyId,
        CarbonInterface $from,
        CarbonInterface $to,
        string $projectScope = 'all',
        string $taskScope = 'all',
        string $employeeScope = 'all',
        array $projectIds = [],
        array $taskIds = [],
        array $userIds = [],
        array $clientIds = [],
    ): Collection {
        $spentByUserQuery = $this->spentQuery(
            $companyId,
            $from,
            $to,
            $projectScope,
            $taskScope,
            $employeeScope,
            $projectIds,
            $taskIds,
            $userIds,
            $clientIds,
        );
        $spentQuery = clone $spentByUserQuery;

        $spentSubquery = $spentQuery
            ->selectRaw(
                'seg.task_id, COALESCE(SUM('.self::CLAMPED_DURATION_SQL.'), 0) as spent_seconds',
                [$to->timestamp, $from->timestamp],
            )
            ->groupBy('seg.task_id');

        $spentByUserSubquery = DB::query()
            ->fromSub(
                $spentByUserQuery
                    ->selectRaw(
                        'seg.task_id, seg.user_id, u.name, u.last_name, COALESCE(SUM('.self::CLAMPED_DURATION_SQL.'), 0) as spent_seconds',
                        [$to->timestamp, $from->timestamp],
                    )
                    ->groupBy('seg.task_id', 'seg.user_id', 'u.name', 'u.last_name'),
                'task_user_durations',
            )
            ->selectRaw(
                "task_user_durations.task_id,
                COALESCE(
                    JSONB_AGG(
                        JSONB_BUILD_OBJECT(
                            'user_id', task_user_durations.user_id,
                            'name', task_user_durations.name,
                            'last_name', task_user_durations.last_name,
                            'spent_seconds', task_user_durations.spent_seconds
                        )
                        ORDER BY task_user_durations.spent_seconds DESC, task_user_durations.name ASC, task_user_durations.last_name ASC
                    ),
                    '[]'::jsonb
                ) as spent_by_users",
            )
            ->groupBy('task_user_durations.task_id');

        $query = DB::table('tasks as t')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->leftJoin('task_status_columns as tsc', 'tsc.id', '=', 't.task_status_column_id')
            ->joinSub($spentSubquery, 'task_durations', fn ($join) => $join->on('task_durations.task_id', '=', 't.id'))
            ->leftJoinSub($spentByUserSubquery, 'task_user_spent', fn ($join) => $join->on('task_user_spent.task_id', '=', 't.id'))
            ->leftJoin('task_users as tu', 'tu.task_id', '=', 't.id')
            ->leftJoin('users as u', 'u.id', '=', 'tu.user_id')
            ->where('p.company_id', $companyId);

        $this->applyTaskFilters(
            $query,
            $projectScope,
            $taskScope,
            $employeeScope,
            $projectIds,
            $taskIds,
            $userIds,
            $clientIds,
        );

        return $query
            ->groupBy(
                't.id',
                't.title',
                't.task_status_column_id',
                'tsc.name',
                'tsc.slug',
                'tsc.color',
                'tsc.is_final',
                't.updated_at',
                't.estimation',
                't.project_id',
                'p.name',
                'p.company_id',
                'task_durations.spent_seconds',
                'task_user_spent.spent_by_users',
            )
            ->orderBy('p.name')
            ->orderBy('t.title')
            ->selectRaw(
                "t.id,
                t.title,
                COALESCE(tsc.name, 'Без статуса') as status,
                t.task_status_column_id as status_column_id,
                tsc.name as status_label,
                tsc.slug as status_slug,
                tsc.color as status_color,
                COALESCE(tsc.is_final, false) as status_is_final,
                t.updated_at,
                t.estimation,
                t.project_id,
                p.name as project_name,
                p.company_id as client_id,
                COALESCE(task_durations.spent_seconds, 0) as spent_seconds,
                COALESCE(task_user_spent.spent_by_users, '[]'::jsonb) as spent_by_users,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT u.id), NULL) as assignee_ids,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT CONCAT_WS(' ', u.name, u.last_name)), NULL) as assignee_names,
                COALESCE(
                    JSONB_AGG(
                        DISTINCT JSONB_BUILD_OBJECT(
                            'id', u.id,
                            'name', u.name,
                            'last_name', u.last_name,
                            'status', u.status
                        )
                    ) FILTER (WHERE u.id IS NOT NULL),
                    '[]'::jsonb
                ) as assignees",
            )
            ->get();
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds
     * @param  list<string>  $clientIds
     */
    private function spentQuery(
        string $companyId,
        CarbonInterface $from,
        CarbonInterface $to,
        string $projectScope,
        string $taskScope,
        string $employeeScope,
        array $projectIds,
        array $taskIds,
        array $userIds,
        array $clientIds,
    ): Builder {
        $query = DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->leftJoin('task_status_columns as tsc', 'tsc.id', '=', 't.task_status_column_id')
            ->leftJoin('users as u', 'u.id', '=', 'seg.user_id')
            ->where('p.company_id', $companyId)
            ->where('seg.started_at', '<', $to->timestamp)
            ->where('seg.ended_at', '>', $from->timestamp)
            ->when($projectScope === 'active', fn (Builder $query) => $query->where('p.status', 'ACTIVE'))
            ->when($projectScope === 'archived', fn (Builder $query) => $query->where('p.status', 'ARCHIVED'))
            ->when($taskScope === 'active', function (Builder $query): void {
                $query->where(fn (Builder $query) => $query->whereNull('tsc.id')->orWhere('tsc.is_final', false));
            })
            ->when($taskScope === 'archived', fn (Builder $query) => $query->where('tsc.is_final', true))
            ->when($employeeScope === 'active', function (Builder $query): void {
                $query->where(fn (Builder $query) => $query->whereNull('u.id')->orWhere('u.status', '<>', 'BLOCKED'));
            })
            ->when($employeeScope === 'archived', fn (Builder $query) => $query->where('u.status', 'BLOCKED'))
            ->when($projectIds !== [], fn (Builder $query) => $query->whereIn('p.id', $projectIds))
            ->when($taskIds !== [], fn (Builder $query) => $query->whereIn('t.id', $taskIds))
            ->when($userIds !== [], fn (Builder $query) => $query->whereIn('seg.user_id', $userIds))
            ->when($clientIds !== [], fn (Builder $query) => $query->whereIn('p.client_id', $clientIds));

        return $query;
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds
     * @param  list<string>  $clientIds
     */
    private function applyTaskFilters(
        Builder $query,
        string $projectScope,
        string $taskScope,
        string $employeeScope,
        array $projectIds,
        array $taskIds,
        array $userIds,
        array $clientIds,
    ): void {
        $query
            ->when($projectScope === 'active', fn (Builder $query) => $query->where('p.status', 'ACTIVE'))
            ->when($projectScope === 'archived', fn (Builder $query) => $query->where('p.status', 'ARCHIVED'))
            ->when($taskScope === 'active', function (Builder $query): void {
                $query->where(fn (Builder $query) => $query->whereNull('tsc.id')->orWhere('tsc.is_final', false));
            })
            ->when($taskScope === 'archived', fn (Builder $query) => $query->where('tsc.is_final', true))
            ->when($employeeScope === 'active', function (Builder $query): void {
                $query->where(fn (Builder $query) => $query->whereNull('u.id')->orWhere('u.status', '<>', 'BLOCKED'));
            })
            ->when($employeeScope === 'archived', fn (Builder $query) => $query->where('u.status', 'BLOCKED'))
            ->when($projectIds !== [], fn (Builder $query) => $query->whereIn('p.id', $projectIds))
            ->when($taskIds !== [], fn (Builder $query) => $query->whereIn('t.id', $taskIds))
            ->when($userIds !== [], fn (Builder $query) => $query->whereIn('tu.user_id', $userIds))
            ->when($clientIds !== [], fn (Builder $query) => $query->whereIn('p.client_id', $clientIds));
    }
}
