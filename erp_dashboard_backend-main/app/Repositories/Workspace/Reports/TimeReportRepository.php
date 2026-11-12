<?php

namespace App\Repositories\Workspace\Reports;

use App\Enums\ProjectPayrollExclusionScope;
use App\Models\Company;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class TimeReportRepository
{
    private const SEGMENT_DURATION_SQL = '(seg.ended_at - seg.started_at)';

    private const CLAMPED_DURATION_SQL = '(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?))';

    public const PROJECT_KIND_COMMERCIAL = 'commercial';

    public const PROJECT_KIND_INTERNAL = 'internal';

    public const PROJECT_KINDS = [self::PROJECT_KIND_COMMERCIAL, self::PROJECT_KIND_INTERNAL];

    public function company(string $companyId): Company
    {
        return Company::query()->findOrFail($companyId);
    }

    public function timezoneForCompany(string $companyId): string
    {
        return $this->company($companyId)->payrollTimezone();
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds
     * @param  list<string>  $excludeUserIds
     * @param  list<string>  $projectKinds  Вместе с $projectIds задают выбор проектов: подходит проект из списка или нужного типа.
     * @param  list<string>  $managerIds  Проекты, где кто-то из них сейчас руководитель (project_members.is_pm).
     * @param  list<string>|null  $allowedProjectIds  Жёсткое ограничение доступных проектов, null — без ограничения.
     * @param  list<string>  $clientIds  Проекты этих клиентов.
     * @return Collection<int, object>
     */
    public function own(
        string $companyId,
        ?CarbonInterface $from,
        ?CarbonInterface $to,
        string $groupBy,
        array $projectIds = [],
        array $taskIds = [],
        array $userIds = [],
        array $excludeUserIds = [],
        string $timezone = 'UTC',
        array $projectKinds = [],
        array $managerIds = [],
        ?array $allowedProjectIds = null,
        array $clientIds = [],
    ): Collection {
        $query = $this->segmentsQuery($companyId, $from, $to, $projectIds, $taskIds, $projectKinds, $managerIds, $allowedProjectIds, clientIds: $clientIds)
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->where('u.company_id', $companyId)
            ->when($userIds !== [], fn (Builder $query) => $query->whereIn('seg.user_id', $userIds))
            ->when($excludeUserIds !== [], fn (Builder $query) => $query->whereNotIn('seg.user_id', $excludeUserIds));

        if ($groupBy === 'day') {
            if ($from === null || $to === null) {
                return collect();
            }

            return $query
                ->crossJoinSub($this->localDays($from, $to, $timezone), 'work_days')
                ->whereRaw('seg.started_at < work_days.day_end')
                ->whereRaw('seg.ended_at > work_days.day_start')
                ->selectRaw(
                    "to_char(to_timestamp(work_days.day_start) AT TIME ZONE ?, 'YYYY-MM-DD') as date, "
                    .'SUM(LEAST(seg.ended_at, work_days.day_end, ?) - GREATEST(seg.started_at, work_days.day_start, ?)) as duration_seconds',
                    [$timezone, $to->timestamp, $from->timestamp],
                )
                ->groupBy('work_days.day_start')
                ->orderBy('date')
                ->get();
        }

        [$select, $groups, $orders] = $this->grouping($groupBy, 'u');
        [$durationSql, $bindings] = $this->duration($from, $to);

        $query->selectRaw("{$select}, SUM({$durationSql}) as duration_seconds", $bindings)
            ->groupBy(...$groups);

        foreach ($orders as $order) {
            $query->orderBy($order);
        }

        return $query->get();
    }

    /**
     * Задачи, где затраченное время строго больше оценки, а у задач без оценки — больше $unestimatedLimitSeconds.
     * Период и фильтры отбирают задачи, по которым есть время в периоде, а затраченное считается за всю задачу,
     * как на карточке задачи: по всем сотрудникам и без исключений из зарплаты.
     *
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @param  list<string>|null  $allowedProjectIds
     * @return Collection<int, object>
     */
    public function overrun(
        string $companyId,
        CarbonInterface $from,
        CarbonInterface $to,
        int $unestimatedLimitSeconds,
        array $projectIds = [],
        array $taskIds = [],
        array $userIds = [],
        array $projectKinds = [],
        array $managerIds = [],
        ?array $allowedProjectIds = null,
    ): Collection {
        $periodTaskIds = $this->segmentsQuery(
            $companyId,
            $from,
            $to,
            $projectIds,
            $taskIds,
            $projectKinds,
            $managerIds,
            $allowedProjectIds,
            applyPayrollExclusions: false,
        )
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->where('u.company_id', $companyId)
            ->when($userIds !== [], fn (Builder $query) => $query->whereIn('seg.user_id', $userIds))
            ->select('t.id');

        $spent = DB::table('work_segments as task_seg')
            ->whereIn('task_seg.task_id', $periodTaskIds)
            ->selectRaw('task_seg.task_id, SUM(task_seg.ended_at - task_seg.started_at) as spent_seconds')
            ->groupBy('task_seg.task_id');

        return DB::table('tasks as t')
            ->joinSub($spent, 'spent', 'spent.task_id', '=', 't.id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where(static function (Builder $query) use ($unestimatedLimitSeconds): void {
                $query
                    ->where(static function (Builder $query): void {
                        $query->where('t.estimation', '>', 0)
                            ->whereColumn('spent.spent_seconds', '>', 't.estimation');
                    })
                    ->orWhere(static function (Builder $query) use ($unestimatedLimitSeconds): void {
                        $query
                            ->where(static function (Builder $query): void {
                                $query->whereNull('t.estimation')->orWhere('t.estimation', '<=', 0);
                            })
                            ->where('spent.spent_seconds', '>', $unestimatedLimitSeconds);
                    });
            })
            ->select([
                'p.id as project_id',
                'p.name as project_name',
                't.id as task_id',
                't.title as task_name',
                't.estimation as estimation_seconds',
                'spent.spent_seconds',
            ])
            ->orderBy('p.name')
            ->orderBy('t.title')
            ->orderBy('t.id')
            ->get();
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @param  list<string>|null  $allowedProjectIds
     * @param  list<string>  $clientIds
     */
    private function segmentsQuery(
        string $companyId,
        ?CarbonInterface $from,
        ?CarbonInterface $to,
        array $projectIds,
        array $taskIds,
        array $projectKinds = [],
        array $managerIds = [],
        ?array $allowedProjectIds = null,
        bool $applyPayrollExclusions = true,
        array $clientIds = [],
    ): Builder {
        $query = DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $companyId)
            ->when($to !== null, fn (Builder $query) => $query->where('seg.started_at', '<', $to->timestamp))
            ->when($from !== null, fn (Builder $query) => $query->where('seg.ended_at', '>', $from->timestamp))
            ->when($taskIds !== [], fn (Builder $query) => $query->whereIn('t.id', $taskIds));

        $query = $this->applyProjectFilters($query, $projectIds, $projectKinds, $managerIds, $allowedProjectIds, $clientIds);

        return $applyPayrollExclusions ? $this->applyPayrollExclusions($query) : $query;
    }

    /**
     * Фильтры проектов отчета по времени для запроса, где проект доступен под псевдонимом p.
     *
     * @param  list<string>  $projectIds
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @param  list<string>|null  $allowedProjectIds
     * @param  list<string>  $clientIds
     */
    public function applyProjectFilters(
        Builder $query,
        array $projectIds,
        array $projectKinds = [],
        array $managerIds = [],
        ?array $allowedProjectIds = null,
        array $clientIds = [],
    ): Builder {
        return $query
            ->when($clientIds !== [], fn (Builder $query) => $query->whereIn('p.client_id', $clientIds))
            ->when(
                $projectIds !== [] || $projectKinds !== [],
                fn (Builder $query) => $this->applyProjectSelection($query, $projectIds, $projectKinds),
            )
            ->when($allowedProjectIds !== null, fn (Builder $query) => $query->whereIn('p.id', $allowedProjectIds))
            ->when($managerIds !== [], fn (Builder $query) => $query->whereExists(
                static function (Builder $query) use ($managerIds): void {
                    $query->selectRaw('1')
                        ->from('project_members as manager_member')
                        ->whereColumn('manager_member.project_id', 'p.id')
                        ->where('manager_member.is_pm', true)
                        ->whereIn('manager_member.user_id', $managerIds);
                },
            ));
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $projectKinds
     */
    private function applyProjectSelection(Builder $query, array $projectIds, array $projectKinds): Builder
    {
        return $query->where(static function (Builder $query) use ($projectIds, $projectKinds): void {
            if ($projectIds !== []) {
                $query->orWhereIn('p.id', $projectIds);
            }

            if (in_array(self::PROJECT_KIND_INTERNAL, $projectKinds, true)) {
                $query->orWhere('p.is_internal', true);
            }

            if (in_array(self::PROJECT_KIND_COMMERCIAL, $projectKinds, true)) {
                $query->orWhere(static function (Builder $query): void {
                    $query->where('p.is_internal', false)->orWhereNull('p.is_internal');
                });
            }
        });
    }

    /** @return array{0:string, 1:list<string>, 2:list<string>} */
    private function grouping(string $groupBy, string $userAlias): array
    {
        return match ($groupBy) {
            'task' => [
                'p.id as project_id, p.name as project_name, t.id as task_id, t.title as task_name',
                ['p.id', 'p.name', 't.id', 't.title'],
                ['p.name', 't.title'],
            ],
            'project' => ['p.id as project_id, p.name as project_name', ['p.id', 'p.name'], ['p.name']],
            default => [
                "{$userAlias}.id as user_id, CONCAT_WS(' ', {$userAlias}.name, {$userAlias}.last_name) as user_name",
                ["{$userAlias}.id", "{$userAlias}.name", "{$userAlias}.last_name"],
                ["{$userAlias}.name", "{$userAlias}.last_name"],
            ],
        };
    }

    /** @return array{0:string, 1:list<int>} */
    private function duration(?CarbonInterface $from, ?CarbonInterface $to): array
    {
        return $from !== null && $to !== null
            ? [self::CLAMPED_DURATION_SQL, [$to->timestamp, $from->timestamp]]
            : [self::SEGMENT_DURATION_SQL, []];
    }

    private function localDays(CarbonInterface $from, CarbonInterface $to, string $timezone): Builder
    {
        $firstDay = Carbon::instance($from)->copy()->setTimezone($timezone)->toDateString();
        $lastDay = Carbon::instance($to)->copy()->subSecond()->setTimezone($timezone)->toDateString();

        return DB::query()
            ->fromRaw("generate_series(?::date::timestamp, ?::date::timestamp, interval '1 day') as dates(day)", [
                $firstDay,
                $lastDay,
            ])
            ->selectRaw(
                'EXTRACT(EPOCH FROM (dates.day AT TIME ZONE ?))::bigint AS day_start, '
                .'EXTRACT(EPOCH FROM ((dates.day + interval \'1 day\') AT TIME ZONE ?))::bigint AS day_end',
                [$timezone, $timezone],
            );
    }

    private function applyPayrollExclusions(Builder $query): Builder
    {
        return $query->where(static function (Builder $query): void {
            $query->where('p.exclude_from_payroll', false)
                ->orWhereNull('p.exclude_from_payroll')
                ->orWhere(static function (Builder $query): void {
                    $query->where('p.exclude_from_payroll', true)
                        ->where('p.payroll_exclusion_scope', ProjectPayrollExclusionScope::SELECTED->value)
                        ->whereNotExists(static function (Builder $query): void {
                            $query->selectRaw('1')
                                ->from('project_payroll_excluded_employees as excluded_employee')
                                ->whereColumn('excluded_employee.project_id', 'p.id')
                                ->whereColumn('excluded_employee.user_id', 'seg.user_id');
                        });
                });
        });
    }
}
