<?php

namespace App\Services\Payroll\Calculation\Rates;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollProjectHoursType;
use App\Enums\PayrollRangeCalculationMethod;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Services\Payroll\Calculation\Rates\Data\PayrollRateCalculationResult;
use App\Services\Payroll\Calculation\Rates\Data\PayrollRateLine;
use App\Services\Payroll\Calculation\Rates\Types\EmployeeRatePayrollService;
use App\Services\Payroll\Hours\PayrollHoursService;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Support\Collection;

class WeeklyEmployeeRatePayrollService
{
    public function __construct(
        private readonly PayrollHoursService $payrollHours,
    ) {}

    /**
     * Упрощенный вход для расчета полной недели без отдельного расчетного среза.
     *
     * @param  EmployeeRatePayrollService  $rateService  Сервис конкретного типа ставки.
     * @param  Company  $company  Компания сотрудника.
     * @param  User  $employee  Сотрудник, для которого считается корректировка.
     * @param  EmployeeRate  $rate  Срез ставки сотрудника.
     * @param  CarbonInterface  $from  Начало недели.
     * @param  CarbonInterface  $to  Конец недели.
     */
    public function calculate(
        EmployeeRatePayrollService $rateService,
        Company $company,
        User $employee,
        EmployeeRate $rate,
        CarbonInterface $from,
        CarbonInterface $to,
    ): ?PayrollRateCalculationResult {
        $periodTo = $to->format('H:i:s') === '00:00:00'
            ? $to->copy()->addDay()
            : $to;

        return $this->calculateForPeriod(
            $rateService,
            $company,
            $employee,
            $rate,
            $from,
            $periodTo,
            $from,
            $periodTo,
        );
    }

    /**
     * Считает целевую сумму для части недели.
     *
     * Для расширенной формулы диапазон определяется по часам всей недели, а сумма
     * применяется только к часам периода. Обычная ставка считается по часам периода.
     * Часы проектов с отдельной ставкой входят в диапазоны, но оплачиваются по ставке
     * проекта и возвращаются отдельными суммами.
     *
     * @param  EmployeeRatePayrollService  $rateService  Сервис конкретного типа ставки.
     * @param  Company  $company  Компания сотрудника.
     * @param  User  $employee  Сотрудник, для которого считается корректировка.
     * @param  EmployeeRate  $rate  Срез ставки сотрудника.
     * @param  CarbonInterface  $periodFrom  Начало интервала действия ставки.
     * @param  CarbonInterface  $periodTo  Конец интервала действия ставки.
     * @param  CarbonInterface  $weekFrom  Начало полной недели.
     * @param  CarbonInterface  $weekTo  Конец полной недели.
     */
    public function calculateForPeriod(
        EmployeeRatePayrollService $rateService,
        Company $company,
        User $employee,
        EmployeeRate $rate,
        CarbonInterface $periodFrom,
        CarbonInterface $periodTo,
        CarbonInterface $weekFrom,
        CarbonInterface $weekTo,
    ): ?PayrollRateCalculationResult {
        $setting = $rateService->settingForDate($rate);
        $projectRates = $setting?->projectRatesById() ?? collect();
        // Часы периода определяют начисляемую сумму; часы недели выбирают диапазон advanced-ставки.
        $periodDurations = $rateService->durations($company, $employee, $periodFrom, $periodTo, $setting);
        $weekDurations = $rateService->durations($company, $employee, $weekFrom, $weekTo, $setting);
        $periodRegularDurations = PayrollProjectRateHours::regular($periodDurations, $projectRates);
        $baseAmount = $this->baseAmount(
            $rateService,
            $rate,
            $setting,
            $periodRegularDurations,
            $periodFrom,
            $periodTo,
        );
        $targetAmount = $setting?->isAdvanced
            ? $this->advancedAmount(
                $rateService,
                $setting,
                $weekDurations,
                $periodRegularDurations,
                $periodFrom,
                $periodTo,
                fn (): Collection => $this->dayDurations(
                    $rateService,
                    $company,
                    $employee,
                    $setting,
                    $periodFrom,
                    $periodTo,
                    $weekFrom,
                    $weekTo,
                ),
            )
            : $baseAmount;
        $projectAmounts = PayrollProjectRateHours::amounts($periodDurations, $projectRates);

        if ($targetAmount <= 0 && $projectAmounts->isEmpty()) {
            return null;
        }

        return new PayrollRateCalculationResult(
            amount: max(0, $targetAmount),
            durations: $periodRegularDurations,
            projectAmounts: $projectAmounts,
        );
    }

    protected function baseAmount(
        EmployeeRatePayrollService $rateService,
        EmployeeRate $rate,
        ?PayrollRateSetting $setting,
        Collection $periodDurations,
        CarbonInterface $periodFrom,
        CarbonInterface $periodTo,
    ): int {
        // Обычная ставка: оклад пропорционален рабочим дням, остальные типы — часам.
        $baseRate = $rateService->defaultRate($rate, $setting);

        if ($baseRate <= 0) {
            return 0;
        }

        if ($rateService->type() === EmployeeRateType::WEEKLY_SALARY) {
            return PayrollAmount::weeklySalaryForPeriod($baseRate, $periodFrom, $periodTo);
        }

        return PayrollAmount::fromSeconds((int) $periodDurations->sum('duration_seconds'), $baseRate);
    }

    /**
     * Выбирает advanced-диапазон по часам полной недели и начисляет только часть периода.
     *
     * Диапазон выбирается по всем часам недели, включая проекты с отдельной ставкой.
     * Сумма считается только по обычным часам периода.
     *
     * @param  Closure(): Collection<int, object>  $dayDurations  Часы недели по дням для раздельных ступеней.
     */
    protected function advancedAmount(
        EmployeeRatePayrollService $rateService,
        PayrollRateSetting $setting,
        Collection $weekDurations,
        Collection $periodRegularDurations,
        CarbonInterface $periodFrom,
        CarbonInterface $periodTo,
        Closure $dayDurations,
    ): int {
        $projectRates = $setting->projectRatesById();

        // Раздельные ступени заполняются по порядку дней, поэтому важно, в какой день
        // отработаны часы проекта. Без таких часов достаточно недельного итога.
        if (
            $setting->rangeCalculationMethod === PayrollRangeCalculationMethod::PROGRESSIVE
            && $rateService->type() !== EmployeeRateType::WEEKLY_SALARY
            && PayrollProjectRateHours::project($weekDurations, $projectRates)->isNotEmpty()
        ) {
            return $this->progressiveAmountByDays($setting, $dayDurations());
        }

        if ($setting->splitByProjectType) {
            $weekSecondsByType = $this->payrollHours->secondsByProjectType($weekDurations);
            $periodSecondsByType = $this->payrollHours->secondsByProjectType($periodRegularDurations);

            return collect([
                PayrollProjectHoursType::COMMERCIAL,
                PayrollProjectHoursType::INTERNAL,
            ])->sum(function (PayrollProjectHoursType $projectType) use ($rateService, $setting, $weekSecondsByType, $periodSecondsByType, $periodFrom, $periodTo): int {
                $ranges = $this->rangesForProjectType($setting, $projectType);

                return $this->amountByRanges(
                    $rateService,
                    (int) $weekSecondsByType->get($projectType->value, 0),
                    (int) $periodSecondsByType->get($projectType->value, 0),
                    $ranges,
                    $setting->rangeCalculationMethod,
                    $periodFrom,
                    $periodTo,
                );
            });
        }

        return $this->amountByRanges(
            $rateService,
            (int) $weekDurations->sum('duration_seconds'),
            (int) $periodRegularDurations->sum('duration_seconds'),
            $this->rangesForProjectType($setting, PayrollProjectHoursType::ALL),
            $setting->rangeCalculationMethod,
            $periodFrom,
            $periodTo,
        );
    }

    /**
     * Возвращает часы недели по дням с отметкой, входит ли день в начисляемый период.
     *
     * @return Collection<int, object{in_period:bool, durations:Collection<int, object>}>
     */
    protected function dayDurations(
        EmployeeRatePayrollService $rateService,
        Company $company,
        User $employee,
        PayrollRateSetting $setting,
        CarbonInterface $periodFrom,
        CarbonInterface $periodTo,
        CarbonInterface $weekFrom,
        CarbonInterface $weekTo,
    ): Collection {
        $days = collect();
        $dayFrom = $weekFrom->copy();

        while ($dayFrom->lt($weekTo)) {
            $dayTo = $dayFrom->copy()->addDay()->startOfDay();
            $dayTo = $dayTo->gt($weekTo) ? $weekTo->copy() : $dayTo;

            $days->push((object) [
                'in_period' => $dayFrom->gte($periodFrom) && $dayFrom->lt($periodTo),
                'durations' => $rateService->durations($company, $employee, $dayFrom, $dayTo, $setting),
            ]);
            $dayFrom = $dayTo;
        }

        return $days;
    }

    /**
     * Раскладывает оплату обычных часов интервала по ставкам.
     *
     * Интервал считается целой неделей формулы: сумма строк совпадает с суммой
     * calculateForPeriod(), когда период и неделя совпадают. Часы проектов с отдельной
     * ставкой влияют на выбор и заполнение диапазонов, но в строки не входят.
     *
     * @param  Collection<int, object>  $durations  Все часы интервала по проектам.
     * @param  Closure(): Collection<int, object{in_period:bool, durations:Collection<int, object>}>  $dayDurations  Часы интервала по дням.
     * @return Collection<int, PayrollRateLine>
     */
    public function regularLines(
        EmployeeRateType $type,
        ?PayrollRateSetting $setting,
        int $baseRate,
        Collection $durations,
        Closure $dayDurations,
    ): Collection {
        if (! $type->isHourly()) {
            return collect();
        }

        $projectRates = $setting?->projectRatesById() ?? collect();
        $regularDurations = PayrollProjectRateHours::regular($durations, $projectRates);

        if (! $setting?->isAdvanced) {
            $seconds = (int) $regularDurations->sum('duration_seconds');

            return $seconds > 0 && $baseRate > 0
                ? collect([new PayrollRateLine(PayrollProjectHoursType::ALL, null, null, $baseRate, $seconds, PayrollAmount::fromSeconds($seconds, $baseRate))])
                : collect();
        }

        $isProgressive = $setting->rangeCalculationMethod === PayrollRangeCalculationMethod::PROGRESSIVE;

        if ($isProgressive && PayrollProjectRateHours::project($durations, $projectRates)->isNotEmpty()) {
            return $this->progressiveLinesByDays($setting, $dayDurations());
        }

        $lines = collect();

        foreach ($this->projectTypeGroups($setting) as $projectType => $belongs) {
            $ranges = $this->sortedRanges($setting, PayrollProjectHoursType::from($projectType));
            $groupSeconds = (int) $durations->filter($belongs)->sum('duration_seconds');
            $regularSeconds = (int) $regularDurations->filter($belongs)->sum('duration_seconds');

            if ($isProgressive) {
                // Без часов проектов обычные часы совпадают со всеми часами группы.
                foreach ($ranges as $range) {
                    $from = PayrollAmount::hoursToSeconds($range->fromHours);
                    $to = $range->toHours !== null ? PayrollAmount::hoursToSeconds($range->toHours) : $groupSeconds;
                    $lines->push($this->line($range, max(0, min($groupSeconds, $to) - $from)));
                }

                continue;
            }

            $range = $groupSeconds > 0 ? $this->reachedRange($groupSeconds / 3600, $ranges) : null;
            if ($range) {
                $lines->push($this->line($range, $regularSeconds));
            }
        }

        return $lines->filter(static fn (PayrollRateLine $line): bool => $line->seconds > 0)->values();
    }

    /**
     * Считает раздельные ступени, когда часть часов недели оплачивается по ставкам проектов.
     *
     * @param  Collection<int, object{in_period:bool, durations:Collection<int, object>}>  $days
     */
    protected function progressiveAmountByDays(PayrollRateSetting $setting, Collection $days): int
    {
        return (int) $this->progressiveLinesByDays($setting, $days)->sum('amount');
    }

    /**
     * Все часы заполняют ступени по порядку дней. Внутри дня ступень делится между
     * обычными часами и часами проектов пропорционально их доле в этом дне.
     * В строки попадают только обычные часы дней периода.
     *
     * @param  Collection<int, object{in_period:bool, durations:Collection<int, object>}>  $days
     * @return Collection<int, PayrollRateLine>
     */
    protected function progressiveLinesByDays(PayrollRateSetting $setting, Collection $days): Collection
    {
        $projectRates = $setting->projectRatesById();
        $lines = collect();

        foreach ($this->projectTypeGroups($setting) as $projectType => $belongs) {
            $ranges = $this->sortedRanges($setting, PayrollProjectHoursType::from($projectType));
            $regularSecondsByRange = array_fill(0, $ranges->count(), 0.0);
            $cursor = 0;

            foreach ($days as $day) {
                $durations = $day->durations->filter($belongs);
                $regularSeconds = (int) PayrollProjectRateHours::regular($durations, $projectRates)->sum('duration_seconds');
                $daySeconds = (int) $durations->sum('duration_seconds');

                if ($daySeconds <= 0) {
                    continue;
                }

                if ($day->in_period && $regularSeconds > 0) {
                    $regularShare = $regularSeconds / $daySeconds;

                    foreach ($ranges as $index => $range) {
                        $from = PayrollAmount::hoursToSeconds($range->fromHours);
                        $to = $range->toHours !== null ? PayrollAmount::hoursToSeconds($range->toHours) : PHP_INT_MAX;
                        $overlap = max(0, min($cursor + $daySeconds, $to) - max($cursor, $from));

                        $regularSecondsByRange[$index] += $overlap * $regularShare;
                    }
                }

                $cursor += $daySeconds;
            }

            foreach ($ranges as $index => $range) {
                $lines->push($this->line($range, (int) round($regularSecondsByRange[$index])));
            }
        }

        return $lines->filter(static fn (PayrollRateLine $line): bool => $line->seconds > 0)->values();
    }

    /**
     * Возвращает группы часов формулы: все часы или коммерческие и внутренние отдельно.
     *
     * @return array<string, Closure(object): bool>
     */
    protected function projectTypeGroups(PayrollRateSetting $setting): array
    {
        return $setting->splitByProjectType
            ? [
                PayrollProjectHoursType::COMMERCIAL->value => static fn (object $duration): bool => ! (bool) ($duration->is_internal ?? false),
                PayrollProjectHoursType::INTERNAL->value => static fn (object $duration): bool => (bool) ($duration->is_internal ?? false),
            ]
            : [PayrollProjectHoursType::ALL->value => static fn (object $_duration): bool => true];
    }

    /** @return Collection<int, PayrollRateRange> */
    protected function sortedRanges(PayrollRateSetting $setting, PayrollProjectHoursType $projectType): Collection
    {
        return $this->rangesForProjectType($setting, $projectType)
            ->sortBy(static fn (PayrollRateRange $range): float => $range->fromHours)
            ->values();
    }

    protected function line(PayrollRateRange $range, int $seconds): PayrollRateLine
    {
        return new PayrollRateLine(
            $range->projectHoursType,
            $range->fromHours,
            $range->toHours,
            (int) $range->rate,
            $seconds,
            PayrollAmount::fromSeconds($seconds, (int) $range->rate),
        );
    }

    /**
     * Считает сумму по диапазонам: одной достигнутой ставкой либо прогрессивными ступенями.
     */
    protected function amountByRanges(
        EmployeeRatePayrollService $rateService,
        int $weekSeconds,
        int $periodSeconds,
        Collection $ranges,
        PayrollRangeCalculationMethod $method,
        CarbonInterface $periodFrom,
        CarbonInterface $periodTo,
    ): int {
        if ($weekSeconds <= 0 || $ranges->isEmpty()) {
            return 0;
        }

        $weekHours = $weekSeconds / 3600;

        if ($rateService->type() === EmployeeRateType::WEEKLY_SALARY) {
            $range = $this->reachedRange($weekHours, $ranges);

            return $range ? PayrollAmount::weeklySalaryForPeriod((int) $range->rate, $periodFrom, $periodTo) : 0;
        }

        if ($method === PayrollRangeCalculationMethod::PROGRESSIVE) {
            $weeklyAmount = $this->progressiveAmount($weekSeconds, $ranges);

            return PayrollAmount::proportional($weeklyAmount, $periodSeconds, $weekSeconds);
        }

        $range = $this->reachedRange($weekHours, $ranges);

        return $range ? PayrollAmount::fromSeconds($periodSeconds, (int) $range->rate) : 0;
    }

    /**
     * Возвращает диапазоны нужного типа проекта; ALL используется как резервная настройка.
     */
    protected function rangesForProjectType(
        PayrollRateSetting $setting,
        PayrollProjectHoursType $projectType,
    ): Collection {
        $ranges = $setting->ranges
            ->filter(static fn (PayrollRateRange $range): bool => $range->projectHoursType === $projectType)
            ->values();

        if ($ranges->isNotEmpty()) {
            return $ranges;
        }

        return $setting->ranges
            ->filter(static fn (PayrollRateRange $range): bool => $range->projectHoursType === PayrollProjectHoursType::ALL)
            ->values();
    }

    /** Выбирает единственный диапазон, в который попало количество часов недели. */
    protected function reachedRange(float $hours, Collection $ranges): ?PayrollRateRange
    {
        return $ranges
            ->filter(static function (PayrollRateRange $range) use ($hours): bool {
                $from = $range->fromHours;
                $to = $range->toHours;

                return $hours >= $from && ($to === null || $hours < $to);
            })
            ->sortByDesc(static fn (PayrollRateRange $range): float => $range->fromHours)
            ->first();
    }

    /** Суммирует оплату каждой пройденной ступени прогрессивной шкалы. */
    protected function progressiveAmount(int $seconds, Collection $ranges): int
    {
        $amount = 0;

        foreach ($ranges->sortBy(static fn (PayrollRateRange $range): float => $range->fromHours) as $range) {
            $from = PayrollAmount::hoursToSeconds($range->fromHours);
            $to = $range->toHours !== null ? PayrollAmount::hoursToSeconds($range->toHours) : $seconds;
            $billableSeconds = max(0, min($seconds, $to) - $from);

            $amount += PayrollAmount::fromSeconds($billableSeconds, (int) $range->rate);
        }

        return $amount;
    }
}
