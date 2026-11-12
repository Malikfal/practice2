<?php

namespace App\Repositories\Workspace\FinanceAnalyticsRepositories;

use App\Enums\ProjectManagerPaymentMethod;
use App\Enums\ProjectPayrollExclusionScope;
use App\Models\Company;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Repositories\Workspace\PayrollRepositories\PayrollPeriodRepository;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FinanceAnalyticsWorkTimeRepository
{
    public function __construct(
        private readonly EmployeeRateRepository $employeeRates,
        private readonly PayrollPeriodRepository $payrollPeriods,
    ) {}

    /** @return Collection<int, object{project_id: string, day_start: int|string, duration_seconds: int|string}> */
    public function projectWorkedSecondsByDay(string $companyId, Carbon $from, Carbon $to): Collection
    {
        $fromTimestamp = $from->copy()->startOfDay()->timestamp;
        $toTimestamp = $to->copy()->addDay()->startOfDay()->timestamp;
        $timezone = $from->getTimezone()->getName();
        $localDays = DB::query()
            ->fromRaw("generate_series(?::date::timestamp, ?::date::timestamp, interval '1 day') as dates(day)", [
                $from->toDateString(),
                $to->toDateString(),
            ])
            ->selectRaw(
                'EXTRACT(EPOCH FROM (dates.day AT TIME ZONE ?))::bigint AS day_start, '
                .'EXTRACT(EPOCH FROM ((dates.day + interval \'1 day\') AT TIME ZONE ?))::bigint AS day_end',
                [$timezone, $timezone],
            );

        return DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->crossJoinSub($localDays, 'work_days')
            ->where('p.company_id', $companyId)
            ->where('seg.started_at', '<', $toTimestamp)
            ->where('seg.ended_at', '>', $fromTimestamp)
            ->whereRaw('seg.started_at < work_days.day_end')
            ->whereRaw('seg.ended_at > work_days.day_start')
            ->groupBy('p.id', 'work_days.day_start')
            ->selectRaw('p.id as project_id, work_days.day_start, '
                .'SUM(LEAST(seg.ended_at, work_days.day_end) '
                .'- GREATEST(seg.started_at, work_days.day_start)) as duration_seconds')
            ->get();
    }

    /**
     * @param  Collection<int, string>  $projectIds
     * @return Collection<int, object{user_id: string, name: string, last_name: ?string, email: ?string, duration_seconds: int|string}>
     */
    public function employeeWorkedSeconds(string $companyId, Carbon $from, Carbon $to, Collection $projectIds): Collection
    {
        $rangeFrom = $from->copy()->startOfDay();
        $rangeTo = $to->copy()->addDay()->startOfDay();

        return DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->where('p.company_id', $companyId)
            ->where('seg.started_at', '<', $rangeTo->timestamp)
            ->where('seg.ended_at', '>', $rangeFrom->timestamp)
            ->when($projectIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('p.id', $projectIds->all()))
            ->groupBy('u.id', 'u.name', 'u.last_name', 'u.email')
            ->selectRaw('u.id as user_id, u.name, u.last_name, u.email, '
                .'COALESCE(SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)), 0) as duration_seconds',
                [$rangeTo->timestamp, $rangeFrom->timestamp])
            ->get();
    }

    /**
     * Подконтрольные часы повторяют правила оплаты PM: учитывают историю участия, разрешение оплаты и метод проекта.
     *
     * @param  Collection<int, string>  $projectIds
     * @return Collection<int, object{user_id: string, name: string, last_name: ?string, email: ?string, duration_seconds: int}>
     */
    public function supervisedSeconds(string $companyId, Carbon $from, Carbon $to, Collection $projectIds): Collection
    {
        $company = Company::query()->findOrFail($companyId);
        $rangeFrom = $from->copy()->startOfDay();
        $rangeTo = $to->copy()->addDay()->startOfDay();
        $rows = $this->payrollPeriods->supervisedSlices($company, $rangeFrom, $rangeTo)
            ->flatMap(function (array $slice) use ($company, $projectIds): Collection {
                $excludedWorkerIds = $this->employeeRates->excludedWorkerIds($company, $slice['from']);

                return $this->supervisedForSlice($company, $slice['from'], $slice['to'], $projectIds, $excludedWorkerIds);
            });

        // Назначения и ставки делят период на срезы, но API нужна одна итоговая строка на руководителя.
        return $rows->groupBy('user_id')
            ->map(static function (Collection $employeeRows): object {
                $result = clone $employeeRows->first();
                $result->duration_seconds = (int) $employeeRows->sum('duration_seconds');
                unset($result->manager_payment_method, $result->pm_count);

                return $result;
            })
            ->filter(static fn (object $row): bool => $row->duration_seconds > 0)
            ->values();
    }

    /**
     * @param  Collection<int, string>  $projectIds
     * @param  Collection<int, string>  $excludedWorkerIds
     * @return Collection<int, object>
     */
    private function supervisedForSlice(Company $company, Carbon $from, Carbon $to, Collection $projectIds, Collection $excludedWorkerIds): Collection
    {
        $pmCounts = DB::table('project_assignment_histories as assignment')
            ->selectRaw('assignment.project_id, COUNT(*) as pm_count')
            ->where('assignment.is_pm', true)
            ->where('assignment.is_pm_payroll_enabled', true)
            ->whereDate('assignment.started_on', '<=', $from->toDateString())
            ->where(function (Builder $query) use ($from): void {
                $query->whereNull('assignment.ended_on')->orWhereDate('assignment.ended_on', '>', $from->toDateString());
            })
            ->groupBy('assignment.project_id');

        $query = DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->join('project_assignment_histories as manager_assignment', 'manager_assignment.project_id', '=', 'p.id')
            ->join('users as u', 'u.id', '=', 'manager_assignment.user_id')
            ->joinSub($pmCounts, 'pm_counts', fn ($join) => $join->on('pm_counts.project_id', '=', 'p.id'))
            ->where('p.company_id', $company->id)
            ->where('manager_assignment.is_pm', true)
            ->where('manager_assignment.is_pm_payroll_enabled', true)
            ->whereDate('manager_assignment.started_on', '<=', $from->toDateString())
            ->where(function (Builder $query) use ($from): void {
                $query->whereNull('manager_assignment.ended_on')->orWhereDate('manager_assignment.ended_on', '>', $from->toDateString());
            })
            ->where('seg.started_at', '<', $to->timestamp)
            ->where('seg.ended_at', '>', $from->timestamp)
            ->when($projectIds->isNotEmpty(), fn (Builder $query) => $query->whereIn('p.id', $projectIds->all()))
            ->when($excludedWorkerIds->isNotEmpty(), fn (Builder $query) => $query->whereNotIn('seg.user_id', $excludedWorkerIds->all()))
            ->groupBy('u.id', 'u.name', 'u.last_name', 'u.email', 'p.id', 'p.manager_payment_method', 'pm_counts.pm_count')
            ->selectRaw('u.id as user_id, u.name, u.last_name, u.email, p.manager_payment_method, pm_counts.pm_count, '
                .'SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as duration_seconds',
                [$to->timestamp, $from->timestamp]);

        return $this->applyPayrollExclusions($query)->get()
            ->map(static function (object $row): object {
                $method = ProjectManagerPaymentMethod::tryFrom((string) $row->manager_payment_method)
                    ?? ProjectManagerPaymentMethod::ACCRUE_ALL;
                $row->duration_seconds = match ($method) {
                    ProjectManagerPaymentMethod::DO_NOT_ACCRUE => 0,
                    ProjectManagerPaymentMethod::ACCRUE_PROPORTIONALLY => (int) round(
                        (int) $row->duration_seconds / max(1, (int) $row->pm_count),
                    ),
                    ProjectManagerPaymentMethod::ACCRUE_ALL => (int) $row->duration_seconds,
                };

                return $row;
            })
            ->filter(static fn (object $row): bool => $row->duration_seconds > 0)
            ->values();
    }

    /** Проектные исключения применяются к часам до их передачи руководителям, как при начислении оплаты. */
    private function applyPayrollExclusions(Builder $query): Builder
    {
        return $query->where(static function (Builder $query): void {
            $query->where('p.exclude_from_payroll', false)
                ->orWhereNull('p.exclude_from_payroll')
                ->orWhere(static function (Builder $query): void {
                    $query->where('p.exclude_from_payroll', true)
                        ->where('p.payroll_exclusion_scope', ProjectPayrollExclusionScope::SELECTED->value)
                        ->whereNotExists(static function (Builder $query): void {
                            $query->selectRaw('1')->from('project_payroll_excluded_employees as excluded_employee')
                                ->whereColumn('excluded_employee.project_id', 'p.id')
                                ->whereColumn('excluded_employee.user_id', 'seg.user_id');
                        });
                });
        });
    }
}
