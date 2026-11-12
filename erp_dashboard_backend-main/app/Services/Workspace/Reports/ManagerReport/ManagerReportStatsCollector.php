<?php

namespace App\Services\Workspace\Reports\ManagerReport;

use App\Enums\ProjectManagerPaymentMethod;
use App\Models\Company;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Repositories\Workspace\PayrollRepositories\PayrollPeriodRepository;
use App\Repositories\Workspace\Reports\ManagerReportRepository;
use App\Services\Payroll\Distribution\Data\PayrollProjectAllocation;
use App\Services\Payroll\Distribution\PayrollProjectDistributionService;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Собирает статистику отчета по менеджерам за расчетные периоды зарплаты.
 *
 * Период совпадает с периодом перерасчета ФОТ: неделя, разрезанная границей месяца.
 * Поэтому недели, месяцы, кварталы и годы складываются из сохраненных строк без пересчета.
 */
class ManagerReportStatsCollector
{
    public function __construct(
        private readonly ManagerReportRepository $repository,
        private readonly PayrollPeriodRepository $periods,
        private readonly EmployeeRateRepository $rates,
        private readonly PayrollProjectDistributionService $distribution,
    ) {}

    /**
     * Пересобирает все периоды, которые пересекают диапазон календарных дат компании.
     *
     * @return int Количество обработанных периодов.
     */
    public function collectRange(Company $company, string $fromDate, string $toDate): int
    {
        $timezone = $company->payrollTimezone();
        $from = Carbon::parse($fromDate, $timezone)->startOfDay();
        $to = Carbon::parse($toDate, $timezone)->startOfDay();
        $periodStart = $from->copy()->startOfWeek(CarbonInterface::MONDAY)->max($from->copy()->startOfMonth());
        $periods = PayrollPeriod::between($periodStart, $to->copy()->addDay());
        // Последний период дополняется до конца недели или месяца, чтобы не сохранить его обрезанным.
        $last = $periods->last();
        if ($last && ! $last->to->isSameDay($this->periodEnd($last->from))) {
            $periods->pop();
            $periods->push(new PayrollPeriod($last->from, $this->periodEnd($last->from)));
        }

        $periods->each(fn (PayrollPeriod $period) => $this->collect($company, $period));

        return $periods->count();
    }

    /**
     * Полностью заменяет статистику компании за один расчетный период.
     */
    public function collect(Company $company, PayrollPeriod $period): void
    {
        $timezone = $company->payrollTimezone();
        $from = Carbon::parse($period->from->toDateString(), $timezone)->startOfDay();
        $to = Carbon::parse($period->to->toDateString(), $timezone)->startOfDay();
        $assignments = $this->repository->pmAssignments($company, $from, $to);
        $developerIds = $this->repository->developerIds($company)->flip();
        $stats = [];
        $projectSeconds = [];
        $projectManagers = [];

        foreach ($this->periods->supervisedSlices($company, $from, $to) as $slice) {
            $this->collectSlice($company, $slice['from'], $slice['to'], $assignments, $developerIds, $stats, $projectSeconds, $projectManagers);
        }

        $activeProjectIds = $this->repository
            ->activeProjectIds($assignments->pluck('project_id')->unique()->values(), $from, $to)
            ->flip();
        $rows = $this->rows($company, $from, $to, $stats, $projectSeconds, $projectManagers, $developerIds, $activeProjectIds);
        $this->repository->replacePeriod($company, $from->toDateString(), $rows);
    }

    /**
     * Срез не меняет набор PM и ставок, поэтому PM определяются на его начало, как в расчете зарплаты.
     *
     * Команда проекта - все участники, кроме его PM в этом срезе. Разработчики - часть команды
     * с ролью разработчика. Собственное время PM на проекте хранится отдельно.
     *
     * @param  Collection<int, object>  $assignments
     * @param  Collection<string, int>  $developerIds
     * @param  array<string, array<string, float|int>>  $stats
     * @param  array<string, array{team: int, developer: int}>  $projectSeconds
     * @param  array<string, array<string, true>>  $projectManagers
     */
    private function collectSlice(
        Company $company,
        Carbon $from,
        Carbon $to,
        Collection $assignments,
        Collection $developerIds,
        array &$stats,
        array &$projectSeconds,
        array &$projectManagers,
    ): void {
        $day = $from->toDateString();
        $managersByProject = $assignments
            ->filter(static fn (object $assignment): bool => $assignment->started_on <= $day
                && ($assignment->ended_on === null || $assignment->ended_on > $day))
            ->unique(static fn (object $assignment): string => $assignment->project_id.':'.$assignment->user_id)
            ->groupBy('project_id');

        $sliceSeconds = [];
        $ownSeconds = [];
        foreach ($this->repository->workedSeconds($company, $from, $to) as $worked) {
            $managers = $managersByProject->get($worked->project_id);
            if ($managers?->contains('user_id', $worked->user_id)) {
                $ownSeconds[$worked->project_id][$worked->user_id] = ($ownSeconds[$worked->project_id][$worked->user_id] ?? 0) + $worked->duration_seconds;

                continue;
            }
            $seconds = $sliceSeconds[$worked->project_id] ?? ['team' => 0, 'developer' => 0];
            $seconds['team'] += $worked->duration_seconds;
            if ($developerIds->has($worked->user_id)) {
                $seconds['developer'] += $worked->duration_seconds;
            }
            $sliceSeconds[$worked->project_id] = $seconds;
        }
        foreach ($sliceSeconds as $projectId => $seconds) {
            $total = $projectSeconds[$projectId] ?? ['team' => 0, 'developer' => 0];
            $projectSeconds[$projectId] = [
                'team' => $total['team'] + $seconds['team'],
                'developer' => $total['developer'] + $seconds['developer'],
            ];
        }

        if ($managersByProject->isEmpty()) {
            return;
        }

        $payrollSeconds = $this->repository->payrollSeconds(
            $company,
            $from,
            $to,
            $managersByProject->keys()->map(strval(...)),
            $this->rates->excludedWorkerIds($company, $from)->map(strval(...)),
        );
        $duration = $to->timestamp - $from->timestamp;

        foreach ($managersByProject as $projectId => $managers) {
            $projectId = (string) $projectId;
            $paidCount = $managers->where('is_pm_payroll_enabled', true)->count();
            $method = ProjectManagerPaymentMethod::tryFrom((string) $managers->first()->manager_payment_method)
                ?? ProjectManagerPaymentMethod::ACCRUE_ALL;
            $seconds = $sliceSeconds[$projectId] ?? ['team' => 0, 'developer' => 0];

            foreach ($managers as $assignment) {
                [$share, $supervised] = $this->controlShare(
                    $method,
                    $assignment->is_pm_payroll_enabled,
                    $paidCount,
                    $payrollSeconds->get($projectId, 0),
                );
                $key = $assignment->user_id.'|'.$projectId;
                $stat = $stats[$key] ?? [
                    'developer_seconds' => 0,
                    'team_seconds' => 0,
                    'own_seconds' => 0,
                    'supervised_seconds' => 0,
                    'controlled_team_seconds' => 0.0,
                    'managed_duration' => 0,
                    'controlled_duration' => 0.0,
                ];
                $stat['developer_seconds'] += $seconds['developer'];
                $stat['team_seconds'] += $seconds['team'];
                $stat['own_seconds'] += $ownSeconds[$projectId][$assignment->user_id] ?? 0;
                $stat['supervised_seconds'] += $supervised;
                $stat['controlled_team_seconds'] += $seconds['team'] * $share;
                $stat['managed_duration'] += $duration;
                $stat['controlled_duration'] += $duration * $share;
                $stats[$key] = $stat;
                $projectManagers[$projectId][$assignment->user_id] = true;
            }
        }
    }

    /**
     * Доля проекта, которая приходится на PM по настройке начисления, и его часы под контролем.
     * Часы округляются в каждом срезе так же, как в PayrollDurationRepository::supervised().
     *
     * @return array{0: float, 1: int}
     */
    private function controlShare(
        ProjectManagerPaymentMethod $method,
        bool $isPayrollEnabled,
        int $paidCount,
        int $payrollSeconds,
    ): array {
        if (! $isPayrollEnabled) {
            return [0.0, 0];
        }

        return match ($method) {
            ProjectManagerPaymentMethod::DO_NOT_ACCRUE => [0.0, 0],
            ProjectManagerPaymentMethod::ACCRUE_PROPORTIONALLY => [
                1 / max(1, $paidCount),
                (int) round($payrollSeconds / max(1, $paidCount)),
            ],
            ProjectManagerPaymentMethod::ACCRUE_ALL => [1.0, $payrollSeconds],
        };
    }

    /**
     * Добавляет к часам расходы периода и формирует строки для сохранения.
     *
     * @param  array<string, array<string, float|int>>  $stats
     * @param  array<string, array{team: int, developer: int}>  $projectSeconds
     * @param  array<string, array<string, true>>  $projectManagers
     * @param  Collection<string, int>  $developerIds
     * @param  Collection<string, int>  $activeProjectIds
     * @return array<int, array<string, mixed>>
     */
    private function rows(
        Company $company,
        Carbon $from,
        Carbon $to,
        array $stats,
        array $projectSeconds,
        array $projectManagers,
        Collection $developerIds,
        Collection $activeProjectIds,
    ): array {
        // Архивный весь период проект показывается, только если по нему были часы.
        $stats = array_filter(
            $stats,
            static fn (array $stat, string $key): bool => $activeProjectIds->has(explode('|', $key, 2)[1])
                || $stat['team_seconds'] + $stat['own_seconds'] + $stat['supervised_seconds'] > 0,
            ARRAY_FILTER_USE_BOTH,
        );
        if ($stats === []) {
            return [];
        }

        $lastDay = $to->copy()->subDay();
        $expenses = $this->repository->employeeExpenses($company, $from->toDateString(), $lastDay->toDateString());
        $excludedEmployees = $this->repository->payrollExcludedEmployees($company);
        $managerCosts = $expenses->groupBy('employee_id')->map(static fn (Collection $rows): int => (int) $rows->sum('amount'));
        // Расход команды проекта не включает начисления его PM и сотрудников, исключенных из оплаты проекта.
        $teamExpenses = $expenses->filter(static fn (object $expense): bool => $expense->project_id !== null
            && ! isset($projectManagers[$expense->project_id][$expense->employee_id])
            && ! $excludedEmployees->get($expense->project_id)?->contains($expense->employee_id));
        $projectTeamCosts = $teamExpenses
            ->groupBy('project_id')
            ->map(static fn (Collection $rows): int => (int) $rows->sum('amount'));
        $projectDeveloperCosts = $teamExpenses
            ->filter(static fn (object $expense): bool => $developerIds->has($expense->employee_id))
            ->groupBy('project_id')
            ->map(static fn (Collection $rows): int => (int) $rows->sum('amount'));
        $periodDuration = $to->timestamp - $from->timestamp;
        $now = now();
        $base = [
            'company_id' => (string) $company->id,
            'period_from' => $from->toDateString(),
            'period_to' => $lastDay->toDateString(),
            'week_start' => $from->copy()->startOfWeek(CarbonInterface::MONDAY)->toDateString(),
            'created_at' => $now,
            'updated_at' => $now,
        ];
        $projectRows = [];

        foreach ($stats as $key => $stat) {
            [$managerId, $projectId] = explode('|', $key, 2);
            $total = $projectSeconds[$projectId] ?? ['team' => 0, 'developer' => 0];
            $durationShare = $stat['managed_duration'] / $periodDuration;
            // Расход проекта делится между PM по времени команды (разработчиков); без часов - по длительности назначения.
            [$teamShare, $controlledShare] = $total['team'] > 0
                ? [$stat['team_seconds'] / $total['team'], $stat['controlled_team_seconds'] / $total['team']]
                : [$durationShare, $stat['controlled_duration'] / $periodDuration];
            $developerShare = $total['developer'] > 0 ? $stat['developer_seconds'] / $total['developer'] : $durationShare;
            $teamCost = $projectTeamCosts->get($projectId, 0);

            $projectRows[$managerId][$projectId] = [
                'project_id' => $projectId,
                'developer_seconds' => (int) $stat['developer_seconds'],
                'team_seconds' => (int) $stat['team_seconds'],
                'own_seconds' => (int) $stat['own_seconds'],
                'supervised_seconds' => (int) $stat['supervised_seconds'],
                'developer_cost' => (int) round($projectDeveloperCosts->get($projectId, 0) * $developerShare),
                'team_cost' => (int) round($teamCost * $teamShare),
                'controlled_cost' => (int) round($teamCost * $controlledShare),
                'manager_cost' => 0,
            ];
        }

        $rows = [];
        foreach ($projectRows as $managerId => $projects) {
            $managerCost = $managerCosts->get($managerId, 0);
            $rows[] = [
                ...$base,
                'id' => (string) Str::uuid(),
                'manager_id' => $managerId,
                'project_id' => null,
                'developer_seconds' => 0,
                'team_seconds' => 0,
                'own_seconds' => 0,
                'supervised_seconds' => 0,
                'developer_cost' => 0,
                'team_cost' => 0,
                'controlled_cost' => 0,
                'manager_cost' => $managerCost,
            ];

            // Начисление менеджеру делится между проектами пропорционально часам под контролем.
            $allocations = $this->distribution
                ->distribute($managerCost, collect($projects)->map(static fn (array $project): object => (object) [
                    'project_id' => $project['project_id'],
                    'duration_seconds' => $project['supervised_seconds'],
                ])->values())
                ->filter(static fn (PayrollProjectAllocation $allocation): bool => $allocation->projectId !== null)
                ->mapWithKeys(static fn (PayrollProjectAllocation $allocation): array => [$allocation->projectId => $allocation->amount]);

            foreach ($projects as $projectId => $project) {
                $rows[] = [
                    ...$base,
                    ...$project,
                    'id' => (string) Str::uuid(),
                    'manager_id' => $managerId,
                    'manager_cost' => $allocations->get($projectId, 0),
                ];
            }
        }

        return $rows;
    }

    /** Исключающая граница периода, который начинается с даты: конец недели или месяца. */
    private function periodEnd(Carbon $from): Carbon
    {
        $weekEnd = $from->copy()->startOfWeek(CarbonInterface::MONDAY)->addWeek();
        $monthEnd = $from->copy()->startOfMonth()->addMonthNoOverflow();

        return $weekEnd->min($monthEnd);
    }
}
