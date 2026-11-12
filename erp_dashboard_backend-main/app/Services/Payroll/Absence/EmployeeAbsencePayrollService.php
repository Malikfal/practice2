<?php

namespace App\Services\Payroll\Absence;

use App\Enums\PayrollComponentType;
use App\Models\EmployeeAbsence;
use App\Models\User;
use App\Repositories\Workspace\EmployeeAbsenceRepository;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Illuminate\Support\Collection;

class EmployeeAbsencePayrollService
{
    /**
     * Подключает хранилище отсутствий и правила выбора проектов.
     */
    public function __construct(
        private readonly EmployeeAbsenceRepository $absences,
    ) {}

    /**
     * Возвращает фиксированное отсутствие как обычный расчетный компонент дня.
     */
    public function fixedComponentForDay(User $employee, CarbonInterface $day): ?CalculatedPayrollComponent
    {
        $absence = $this->absences->fixedAbsenceForDate($employee, $day);
        if (! $absence) {
            return null;
        }

        return $this->fixedComponent($absence, $day);
    }

    /**
     * Возвращает фиксированные отсутствия периода как расчетные компоненты по дням.
     *
     * @return Collection<int, CalculatedPayrollComponent>
     */
    public function fixedComponentsForPeriod(
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        $components = collect();

        foreach ($this->absences->fixedAbsencesForPeriod($employee, $from, $to) as $absence) {
            foreach ($this->absenceDaysInside($absence, $from, $to) as $day) {
                $amount = (int) ($absence->calculatedFixedDailyAmount() ?? 0);
                if ($amount <= 0) {
                    continue;
                }

                $components->push($this->fixedComponent($absence, $day));
            }
        }

        return $components;
    }

    /**
     * Разбивает период на интервалы, где сотрудник не находится на фиксированном отсутствии.
     *
     * @return Collection<int, PayrollPeriod>
     */
    public function payrollPeriodsExcludingFixedAbsences(
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        $fixedDates = $this->fixedDates($employee, $from, $to);
        $periods = collect();
        $currentFrom = null;
        $day = Carbon::instance($from)->copy()->startOfDay();

        while ($day->lt($to)) {
            $isFixed = $fixedDates->has($day->toDateString());

            if (! $isFixed && $currentFrom === null) {
                $currentFrom = $day->copy();
            }

            if (($isFixed || $day->copy()->addDay()->gte($to)) && $currentFrom !== null) {
                $periodTo = $isFixed ? $day->copy() : $day->copy()->addDay();
                if ($currentFrom->lt($periodTo)) {
                    $periods->push(new PayrollPeriod(from: $currentFrom, to: $periodTo));
                }
                $currentFrom = null;
            }

            $day->addDay();
        }

        return $periods;
    }

    /**
     * @return Collection<string, true>
     */
    private function fixedDates(User $employee, CarbonInterface $from, CarbonInterface $to): Collection
    {
        return $this->absences
            ->fixedAbsencesForPeriod($employee, $from, $to)
            ->flatMap(fn (EmployeeAbsence $absence): Collection => collect($this
                ->absenceDaysInside($absence, $from, $to))
                ->mapWithKeys(static fn (CarbonInterface $day): array => [$day->toDateString() => true]));
    }

    private function absenceDaysInside(
        EmployeeAbsence $absence,
        CarbonInterface $from,
        CarbonInterface $to,
    ): CarbonPeriod {
        // Даты отсутствия — календарные дни компании: переносим их в часовой пояс периода,
        // иначе полночь в поясе приложения сдвигает границы и теряет последний день.
        $timezone = $from->getTimezone();
        $dateFrom = Carbon::parse($absence->date_from->toDateString(), $timezone);
        $dateTo = Carbon::parse($absence->date_to->toDateString(), $timezone);
        $absenceFrom = $dateFrom->greaterThan($from)
            ? $dateFrom
            : Carbon::instance($from)->copy()->startOfDay();
        $absenceTo = $dateTo->lessThan($to)
            ? $dateTo
            : Carbon::instance($to)->copy()->subDay()->startOfDay();

        return CarbonPeriod::create($absenceFrom, $absenceTo);
    }

    /**
     * Собирает расчетный компонент фиксированного отсутствия для общего распределителя.
     */
    private function fixedComponent(
        EmployeeAbsence $absence,
        CarbonInterface $day,
    ): CalculatedPayrollComponent {
        $amount = (int) ($absence->calculatedFixedDailyAmount() ?? 0);

        return new CalculatedPayrollComponent(
            PayrollComponentType::FIXED_ABSENCE,
            $amount,
            $day->copy()->startOfDay(),
            $day->copy()->addDay()->startOfDay(),
            collect(),
            $absence,
        );
    }
}
