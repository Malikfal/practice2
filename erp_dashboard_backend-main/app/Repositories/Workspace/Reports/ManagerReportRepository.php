<?php

namespace App\Repositories\Workspace\Reports;

use App\Enums\FinanceType;
use App\Enums\ProjectPayrollExclusionScope;
use App\Models\Company;
use App\Models\ManagerReportStat;
use App\Repositories\Workspace\PayrollRepositories\PayrollDurationRepository;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class ManagerReportRepository
{
    /** Системные имена ролей разработчиков. "Тимлид" - роль, добавленная компанией. */
    private const DEVELOPER_ROLES = ['WORKER', 'TIMLID'];

    public function __construct(private readonly PayrollDurationRepository $payrollDurations) {}

    /**
     * PM-назначения проектов компании, которые действуют хотя бы один день периода.
     * Проекты, целиком исключенные из оплаты галкой "Не учитывать часы проекта в оплате", не входят.
     *
     * @return Collection<int, object{project_id: string, user_id: string, is_pm_payroll_enabled: bool, started_on: string, ended_on: ?string, manager_payment_method: ?string}>
     */
    public function pmAssignments(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return DB::table('project_assignment_histories as assignment')
            ->join('projects as p', 'p.id', '=', 'assignment.project_id')
            ->where('p.company_id', $company->id)
            ->where('assignment.is_pm', true)
            // Период назначения полуоткрытый: [started_on, ended_on).
            ->whereDate('assignment.started_on', '<', $to->toDateString())
            ->where(static function (Builder $query) use ($from): void {
                $query->whereNull('assignment.ended_on')
                    ->orWhereDate('assignment.ended_on', '>', $from->toDateString());
            })
            ->where(static function (Builder $query): void {
                $query->where('p.exclude_from_payroll', false)
                    ->orWhereNull('p.exclude_from_payroll')
                    ->orWhere('p.payroll_exclusion_scope', ProjectPayrollExclusionScope::SELECTED->value);
            })
            ->orderBy('assignment.started_on')
            ->get([
                'assignment.project_id',
                'assignment.user_id',
                'assignment.is_pm_payroll_enabled',
                'assignment.started_on',
                'assignment.ended_on',
                'p.manager_payment_method',
            ])
            ->map(static function (object $assignment): object {
                $assignment->project_id = (string) $assignment->project_id;
                $assignment->user_id = (string) $assignment->user_id;
                $assignment->is_pm_payroll_enabled = (bool) $assignment->is_pm_payroll_enabled;
                $assignment->started_on = substr((string) $assignment->started_on, 0, 10);
                $assignment->ended_on = $assignment->ended_on ? substr((string) $assignment->ended_on, 0, 10) : null;

                return $assignment;
            });
    }

    /**
     * Проекты, которые были не в архиве хотя бы один день периода. Проект без истории активности считается активным.
     *
     * @param  Collection<int, string>  $projectIds
     * @return Collection<int, string>
     */
    public function activeProjectIds(Collection $projectIds, CarbonInterface $from, CarbonInterface $to): Collection
    {
        if ($projectIds->isEmpty()) {
            return collect();
        }

        $withHistory = DB::table('project_activity_histories')
            ->whereIn('project_id', $projectIds->values()->all())
            ->distinct()
            ->pluck('project_id')
            ->map(strval(...));
        $active = DB::table('project_activity_histories')
            ->whereIn('project_id', $withHistory->all())
            ->whereDate('started_on', '<', $to->toDateString())
            ->where(static function (Builder $query) use ($from): void {
                $query->whereNull('ended_on')
                    ->orWhereDate('ended_on', '>', $from->toDateString());
            })
            ->distinct()
            ->pluck('project_id')
            ->map(strval(...));

        return $projectIds->diff($withHistory)->merge($active)->unique()->values();
    }

    /**
     * Сотрудники компании, которых отчет считает разработчиками: роль "Сотрудник" или "Тимлид".
     * Руководство, менеджеры и РПО сюда не входят.
     *
     * @return Collection<int, string>
     */
    public function developerIds(Company $company): Collection
    {
        return DB::table('users as u')
            ->join('roles as r', 'r.id', '=', 'u.role_id')
            ->where('u.company_id', $company->id)
            ->whereIn('r.name', self::DEVELOPER_ROLES)
            ->pluck('u.id')
            ->map(strval(...));
    }

    /**
     * Сотрудники, исключенные из оплаты проекта галкой "Не учитывать часы проекта в оплате" для части сотрудников.
     *
     * @return Collection<string, Collection<int, string>> ID сотрудников по ID проекта.
     */
    public function payrollExcludedEmployees(Company $company): Collection
    {
        return DB::table('project_payroll_excluded_employees as excluded_employee')
            ->join('projects as p', 'p.id', '=', 'excluded_employee.project_id')
            ->where('p.company_id', $company->id)
            ->where('p.exclude_from_payroll', true)
            ->where('p.payroll_exclusion_scope', ProjectPayrollExclusionScope::SELECTED->value)
            ->get(['excluded_employee.project_id', 'excluded_employee.user_id'])
            ->groupBy(static fn (object $row): string => (string) $row->project_id)
            ->map(static fn (Collection $rows): Collection => $rows->pluck('user_id')->map(strval(...))->values());
    }

    /**
     * Фактическое время по проекту и сотруднику внутри среза. Учитывает исключения проекта из оплаты,
     * но не ставки сотрудников: неоплачиваемые проекты и часы не входят в отчет.
     *
     * @return Collection<int, object{project_id: string, user_id: string, duration_seconds: int}>
     */
    public function workedSeconds(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $start = $from->timestamp;
        $end = $to->timestamp;

        return $this->payrollDurations->applyPayrollExclusions(DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $company->id)
            ->where('seg.started_at', '<', $end)
            ->where('seg.ended_at', '>', $start))
            ->groupBy('p.id', 'seg.user_id')
            ->selectRaw(
                'p.id as project_id, seg.user_id, SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as duration_seconds',
                [$end, $start],
            )
            ->get()
            ->map(static fn (object $row): object => (object) [
                'project_id' => (string) $row->project_id,
                'user_id' => (string) $row->user_id,
                'duration_seconds' => (int) $row->duration_seconds,
            ])
            ->filter(static fn (object $row): bool => $row->duration_seconds > 0)
            ->values();
    }

    /**
     * Время проектов, за которое начисляется оплата PM: те же исключения, что в расчете зарплаты.
     *
     * @param  Collection<int, string>  $projectIds
     * @param  Collection<int, string>  $excludedWorkerIds
     * @return Collection<string, int> Секунды по ID проекта.
     */
    public function payrollSeconds(
        Company $company,
        CarbonInterface $from,
        CarbonInterface $to,
        Collection $projectIds,
        Collection $excludedWorkerIds,
    ): Collection {
        if ($projectIds->isEmpty()) {
            return collect();
        }

        $start = $from->timestamp;
        $end = $to->timestamp;

        return $this->payrollDurations->applyPayrollExclusions(DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $company->id)
            ->whereIn('p.id', $projectIds->values()->all())
            ->where('seg.started_at', '<', $end)
            ->where('seg.ended_at', '>', $start)
            ->when(
                $excludedWorkerIds->isNotEmpty(),
                fn (Builder $query) => $query->whereNotIn('seg.user_id', $excludedWorkerIds->values()->all()),
            ))
            ->groupBy('p.id')
            ->selectRaw(
                'p.id as project_id, SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as duration_seconds',
                [$end, $start],
            )
            ->get()
            ->mapWithKeys(static fn (object $row): array => [(string) $row->project_id => (int) $row->duration_seconds]);
    }

    /**
     * Расходы на сотрудников по фактической дате платежа, как в отчете «Расчет ФОТ».
     *
     * @return Collection<int, object{employee_id: string, project_id: ?string, amount: int}>
     */
    public function employeeExpenses(Company $company, string $fromDate, string $toDate): Collection
    {
        return DB::table('finance')
            ->where('company_id', $company->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereNotNull('employee_id')
            ->whereDate('dateOfPayment', '>=', $fromDate)
            ->whereDate('dateOfPayment', '<=', $toDate)
            ->groupBy('employee_id', 'project_id')
            ->selectRaw('employee_id, project_id, SUM(amount) as amount')
            ->get()
            ->map(static fn (object $row): object => (object) [
                'employee_id' => (string) $row->employee_id,
                'project_id' => $row->project_id ? (string) $row->project_id : null,
                'amount' => (int) $row->amount,
            ]);
    }

    /**
     * Заменяет статистику компании за один расчетный период.
     *
     * @param  array<int, array<string, mixed>>  $rows
     */
    public function replacePeriod(Company $company, string $periodFrom, array $rows): void
    {
        DB::transaction(function () use ($company, $periodFrom, $rows): void {
            ManagerReportStat::query()
                ->where('company_id', $company->id)
                ->whereDate('period_from', $periodFrom)
                ->delete();

            foreach (array_chunk($rows, 500) as $chunk) {
                ManagerReportStat::query()->insert($chunk);
            }
        });
    }

    /**
     * Строки статистики, чей период начинается внутри выбранного диапазона.
     *
     * @return Collection<int, ManagerReportStat>
     */
    public function stats(string $companyId, string $fromDate, string $toDate): Collection
    {
        return ManagerReportStat::query()
            ->where('company_id', $companyId)
            ->whereDate('period_from', '>=', $fromDate)
            ->whereDate('period_from', '<=', $toDate)
            ->with('project:id,name,is_internal')
            ->orderBy('period_from')
            ->get();
    }

    /**
     * Все менеджеры, по которым уже накоплена статистика компании.
     *
     * @return Collection<int, object{id: string, name: ?string, last_name: ?string, email: ?string}>
     */
    public function managers(string $companyId): Collection
    {
        return DB::table('users as u')
            ->whereIn('u.id', ManagerReportStat::query()
                ->where('company_id', $companyId)
                ->select('manager_id')
                ->distinct())
            ->orderBy('u.name')
            ->orderBy('u.last_name')
            ->get(['u.id', 'u.name', 'u.last_name', 'u.email']);
    }
}
