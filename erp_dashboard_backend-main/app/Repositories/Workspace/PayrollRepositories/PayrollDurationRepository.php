<?php

namespace App\Repositories\Workspace\PayrollRepositories;

use App\Enums\ProjectManagerPaymentMethod;
use App\Enums\ProjectPayrollExclusionScope;
use App\Models\Company;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PayrollDurationRepository
{
    public function __construct(
        private readonly EmployeeRateRepository $rates,
        private readonly PayrollPeriodRepository $periods,
    ) {}

    /**
     * Суммирует собственные часы сотрудника по проектам за период.
     *
     * @return Collection<int, object>
     */
    public function own(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        return $this->baseQuery($company, $from, $to)
            ->where('seg.user_id', $employee->id)
            ->get();
    }

    /**
     * Считает подконтрольные часы менеджера с учётом ставок и истории назначений PM.
     *
     * @return Collection<int, object>
     */
    public function supervised(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        $durations = $this->periods
            ->supervisedSlices($company, $from, $to)
            ->flatMap(function (array $slice) use ($company, $employee): Collection {
                $excludedWorkerIds = $this->rates
                    ->excludedWorkerIds($company, $slice['from'])
                    ->values();

                return $this->supervisedForSlice(
                    $company,
                    $employee,
                    $slice['from'],
                    $slice['to'],
                    $excludedWorkerIds,
                );
            });

        return $this->mergeByProject($durations);
    }

    /**
     * Суммирует собственные часы всех сотрудников компании за период одним запросом.
     * Результат совпадает с суммой own() по каждому сотруднику.
     *
     * @return Collection<string, int> user_id => секунды
     */
    public function ownSecondsByEmployee(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $start = $from->timestamp;
        $end = $to->timestamp;

        return $this->applyPayrollExclusions(DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $company->id)
            ->where('seg.started_at', '<', $end)
            ->where('seg.ended_at', '>', $start)
            ->selectRaw(
                'seg.user_id, SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as duration_seconds',
                [$end, $start],
            )
            ->groupBy('seg.user_id'))
            ->get()
            ->mapWithKeys(static fn (object $row): array => [(string) $row->user_id => (int) $row->duration_seconds]);
    }

    /**
     * Суммирует подконтрольные часы всех менеджеров компании за период.
     * Округление и срезы те же, что в supervised(), поэтому сумма совпадает с расчётом по каждому сотруднику.
     *
     * @return Collection<string, int> user_id => секунды
     */
    public function supervisedSecondsByEmployee(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $seconds = [];

        foreach ($this->periods->supervisedSlices($company, $from, $to) as $slice) {
            $excludedWorkerIds = $this->rates
                ->excludedWorkerIds($company, $slice['from'])
                ->values();

            $durations = $this->supervisedForSlice(
                $company,
                null,
                $slice['from'],
                $slice['to'],
                $excludedWorkerIds,
            );

            foreach ($durations as $duration) {
                $userId = (string) $duration->user_id;
                $seconds[$userId] = ($seconds[$userId] ?? 0) + (int) $duration->duration_seconds;
            }
        }

        return collect($seconds);
    }

    /**
     * Считает часы всей компании, исключая сотрудников по настройке действующей ставки.
     *
     * @return Collection<int, object>
     */
    public function company(Company $company, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $durations = $this->periods
            ->rateSlices($company, $from, $to)
            ->flatMap(function (array $slice) use ($company): Collection {
                $excludedWorkerIds = $this->rates->excludedWorkerIds($company, $slice['from']);

                return $this->baseQuery($company, $slice['from'], $slice['to'])
                    ->when(
                        $excludedWorkerIds->isNotEmpty(),
                        fn (Builder $query) => $query->whereNotIn('seg.user_id', $excludedWorkerIds->all()),
                    )
                    ->get();
            });

        return $this->mergeByProject($durations);
    }

    /**
     * Без сотрудника возвращает строки всех оплачиваемых менеджеров с колонкой user_id.
     */
    private function supervisedForSlice(
        Company $company,
        ?User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        Collection $excludedWorkerIds,
    ): Collection {
        $start = $from->timestamp;
        $end = $to->timestamp;
        // Обрезаем каждый work segment границами текущего среза и суммируем по проекту.
        $participantDurations = $this->applyPayrollExclusions(DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $company->id)
            ->where('seg.started_at', '<', $end)
            ->where('seg.ended_at', '>', $start)
            ->when(
                $excludedWorkerIds->isNotEmpty(),
                fn (Builder $query) => $query->whereNotIn('seg.user_id', $excludedWorkerIds->all()),
            )
            ->selectRaw(
                'p.id as project_id, SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as duration_seconds',
                [$end, $start],
            )
            ->groupBy('p.id'));

        // Считаем оплачиваемых PM, которые были назначены на проект в начале среза.
        // ended_on не включается: период назначения действует как [started_on, ended_on).
        $pmCounts = DB::table('project_assignment_histories as assignment')
            ->selectRaw('assignment.project_id, COUNT(*) as pm_count')
            ->where('assignment.is_pm', true)
            ->where('assignment.is_pm_payroll_enabled', true)
            ->whereDate('assignment.started_on', '<=', $from->toDateString())
            ->where(function (Builder $query) use ($from): void {
                $query
                    ->whereNull('assignment.ended_on')
                    ->orWhereDate('assignment.ended_on', '>', $from->toDateString());
            })
            ->groupBy('assignment.project_id');

        // Выбираем проекты, где рассчитываемый сотрудник сам был активным оплачиваемым PM.
        $managerAssignments = DB::table('project_assignment_histories as manager_assignment')
            ->join('projects as p', 'p.id', '=', 'manager_assignment.project_id')
            ->joinSub($participantDurations, 'participant_durations', function ($join): void {
                $join->on('participant_durations.project_id', '=', 'p.id');
            })
            ->joinSub($pmCounts, 'pm_counts', function ($join): void {
                $join->on('pm_counts.project_id', '=', 'p.id');
            })
            ->where('p.company_id', $company->id)
            ->when($employee, static fn (Builder $query) => $query->where('manager_assignment.user_id', $employee->id))
            ->where('manager_assignment.is_pm', true)
            ->where('manager_assignment.is_pm_payroll_enabled', true)
            ->whereDate('manager_assignment.started_on', '<=', $from->toDateString())
            ->where(function (Builder $query) use ($from): void {
                $query
                    ->whereNull('manager_assignment.ended_on')
                    ->orWhereDate('manager_assignment.ended_on', '>', $from->toDateString());
            })
            ->where('participant_durations.duration_seconds', '>', 0)
            ->selectRaw(
                'manager_assignment.user_id, p.id as project_id, p.name as project_name, p.is_internal, p.manager_payment_method, pm_counts.pm_count, participant_durations.duration_seconds',
            );

        return $managerAssignments->get()
            ->map(static function (object $duration): object {
                $method = ProjectManagerPaymentMethod::tryFrom((string) $duration->manager_payment_method)
                    ?? ProjectManagerPaymentMethod::ACCRUE_ALL;

                $duration->duration_seconds = match ($method) {
                    ProjectManagerPaymentMethod::DO_NOT_ACCRUE => 0,
                    ProjectManagerPaymentMethod::ACCRUE_PROPORTIONALLY => (int) round(
                        (int) $duration->duration_seconds / max(1, (int) $duration->pm_count),
                    ),
                    ProjectManagerPaymentMethod::ACCRUE_ALL => (int) $duration->duration_seconds,
                };

                return $duration;
            })
            ->filter(static fn (object $duration): bool => $duration->duration_seconds > 0)
            ->values();
    }

    private function baseQuery(Company $company, CarbonInterface $from, CarbonInterface $to): Builder
    {
        $start = $from->timestamp;
        $end = $to->timestamp;

        return $this->applyPayrollExclusions(DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('p.company_id', $company->id)
            ->where('seg.started_at', '<', $end)
            ->where('seg.ended_at', '>', $start)
            ->selectRaw(
                'p.id as project_id, p.name as project_name, p.is_internal, SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as duration_seconds',
                [$end, $start],
            )
            ->groupBy('p.id', 'p.name', 'p.is_internal')
            ->havingRaw('SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) > 0', [$end, $start]));
    }

    private function mergeByProject(Collection $durations): Collection
    {
        // После расчёта отдельных срезов возвращаем одну итоговую строку на проект.
        return $durations
            ->groupBy('project_id')
            ->map(static function (Collection $projectDurations): object {
                $duration = clone $projectDurations->first();
                $duration->duration_seconds = (int) $projectDurations->sum('duration_seconds');
                unset($duration->pm_count, $duration->manager_payment_method, $duration->user_id);

                return $duration;
            })
            ->filter(static fn (object $duration): bool => $duration->duration_seconds > 0)
            ->values();
    }

    /**
     * Убирает сегменты, исключенные из начисления настройками проекта.
     * Запрос должен использовать алиасы `p` для проекта и `seg` для сегмента.
     */
    public function applyPayrollExclusions(Builder $query): Builder
    {
        return $query->where(static function (Builder $query): void {
            $query
                ->where('p.exclude_from_payroll', false)
                ->orWhereNull('p.exclude_from_payroll')
                ->orWhere(static function (Builder $query): void {
                    $query
                        ->where('p.exclude_from_payroll', true)
                        ->where('p.payroll_exclusion_scope', ProjectPayrollExclusionScope::SELECTED->value)
                        // В SELECTED исключаем сегмент, только если его автор выбран в настройке проекта.
                        ->whereNotExists(static function (Builder $query): void {
                            $query
                                ->selectRaw('1')
                                ->from('project_payroll_excluded_employees as excluded_employee')
                                ->whereColumn('excluded_employee.project_id', 'p.id')
                                ->whereColumn('excluded_employee.user_id', 'seg.user_id');
                        });
                });
        });
    }
}
