<?php

namespace App\Repositories\Workspace\Reports;

use App\Enums\ProjectStatus;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LimitReportRepository
{
    public function __construct(
        private readonly TimeReportRepository $timeReports,
    ) {}

    /**
     * Проекты с недельным лимитом у проекта или у его клиента и время по ним за период одним запросом.
     * Время считается по всем сотрудникам компании без исключений из зарплаты: лимит — это часы для клиента.
     *
     * Активный проект попадает в отчёт и без времени, чтобы был виден неизрасходованный лимит.
     * Архивный — только если по нему есть время в периоде. С фильтром по задачам или сотрудникам
     * остаются только проекты с подходящим временем.
     *
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @param  list<string>|null  $allowedProjectIds
     * @return Collection<int, object{
     *     project_id: string,
     *     project_name: string|null,
     *     client_id: string|null,
     *     client_name: string|null,
     *     project_weekly_limit_seconds: int|null,
     *     client_weekly_limit_seconds: int|null,
     *     spent_seconds: int|string
     * }>
     */
    public function projects(
        string $companyId,
        CarbonInterface $from,
        CarbonInterface $to,
        array $projectIds = [],
        array $taskIds = [],
        array $userIds = [],
        array $projectKinds = [],
        array $managerIds = [],
        ?array $allowedProjectIds = null,
    ): Collection {
        $spent = DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->leftJoin('clients as c', 'c.id', '=', 'p.client_id')
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->where('p.company_id', $companyId)
            ->where('u.company_id', $companyId)
            ->where(fn (Builder $query) => $this->hasLimit($query))
            ->where('seg.started_at', '<', $to->timestamp)
            ->where('seg.ended_at', '>', $from->timestamp)
            ->when($userIds !== [], fn (Builder $query) => $query->whereIn('seg.user_id', $userIds))
            ->when($taskIds !== [], fn (Builder $query) => $query->whereIn('t.id', $taskIds))
            ->selectRaw(
                't.project_id, SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as spent_seconds',
                [$to->timestamp, $from->timestamp],
            )
            ->groupBy('t.project_id');

        $onlyWithTime = $taskIds !== [] || $userIds !== [];

        $query = DB::table('projects as p')
            ->leftJoin('clients as c', 'c.id', '=', 'p.client_id')
            ->leftJoinSub($spent, 'spent', 'spent.project_id', '=', 'p.id')
            ->where('p.company_id', $companyId)
            ->where(fn (Builder $query) => $this->hasLimit($query))
            ->where(static function (Builder $query) use ($onlyWithTime): void {
                $query->where('spent.spent_seconds', '>', 0);

                if (! $onlyWithTime) {
                    $query->orWhere('p.status', ProjectStatus::ACTIVE->value);
                }
            });

        return $this->timeReports
            ->applyProjectFilters($query, $projectIds, $projectKinds, $managerIds, $allowedProjectIds)
            ->select([
                'p.id as project_id',
                'p.name as project_name',
                'c.id as client_id',
                'c.name as client_name',
                'p.weekly_limit_seconds as project_weekly_limit_seconds',
                'c.weekly_limit_seconds as client_weekly_limit_seconds',
            ])
            ->selectRaw('COALESCE(spent.spent_seconds, 0) as spent_seconds')
            ->orderBy('p.name')
            ->orderBy('p.id')
            ->get();
    }

    private function hasLimit(Builder $query): Builder
    {
        return $query->whereNotNull('p.weekly_limit_seconds')->orWhereNotNull('c.weekly_limit_seconds');
    }
}
