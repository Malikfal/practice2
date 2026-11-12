<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution;

use App\Enums\FinanceArticleDistributionMethod as Method;
use App\Models\Finance;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsWorkTimeRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DayWeightsData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionPeriodData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/** Загружает только базы тех способов распределения, которые встречаются в операциях. */
class DistributionWeightsService
{
    public function __construct(
        private readonly FinanceAnalyticsOperationRepository $operations,
        private readonly FinanceAnalyticsWorkTimeRepository $workTime,
        private readonly PeriodDistributionService $periods,
    ) {}

    /**
     * Загружает карты только для методов, встречающихся в платежах текущего расчёта.
     * Для правильной доли база охватывает полный период платежей, даже если пользователь запросил только его часть.
     *
     * @param  Collection<int, Finance>  $finances
     */
    public function buildForFinances(Collection $finances, string $companyId, string $timezone): DistributionWeightsData
    {
        return new DistributionWeightsData(
            expenses: $this->buildExpenseBasis($finances, $companyId, $timezone),
            volume: $this->buildWorkTimeBasis($finances, $companyId, $timezone),
        );
    }

    /**
     * Строит дневные веса из обычных расходов и исключает распределяемые пропорциональные расходы.
     * Иначе платеж мог бы входить в собственный знаменатель и рекурсивно менять свои доли.
     *
     * @param  Collection<int, Finance>  $finances
     */
    private function buildExpenseBasis(Collection $finances, string $companyId, string $timezone): DayWeightsData
    {
        $range = $this->coveredRangeForMethod($finances, Method::PROPORTIONAL_TO_EXPENSES, $timezone);
        if ($range === null) {
            return new DayWeightsData;
        }

        /** @var Collection<int, Finance> $base */
        $base = $this->operations->expenseDistributionBaseFinances($companyId, $range->from, $range->to);
        $workTimeBasis = new DistributionWeightsData(volume: $this->buildWorkTimeBasis($base, $companyId, $timezone));
        /** @var Collection<string, Collection<string, int>> $projects */
        $projects = collect();
        /** @var Collection<string, int> $all */
        $all = collect();

        foreach ($base as $finance) {
            foreach ($this->periods->amountBuckets($finance, $range->from, $range->to, weights: $workTimeBasis) as $day => $amount) {
                $all->put($day, $all->get($day, 0) + $amount);
                if ($finance->project_id) {
                    $days = $projects->get($finance->project_id, collect());
                    $days->put($day, $days->get($day, 0) + $amount);
                    $projects->put($finance->project_id, $days);
                }
            }
        }

        return new DayWeightsData($all->filter(static fn ($amount): bool => $amount > 0), $projects);
    }

    /**
     * Строит дневные веса из секунд работы по проектам: больше часов означает большую долю платежа.
     *
     * @param  Collection<int, Finance>  $finances
     */
    public function buildWorkTimeBasis(Collection $finances, string $companyId, string $timezone): DayWeightsData
    {
        $range = $this->coveredRangeForMethod($finances, Method::BY_VOLUME, $timezone);
        if ($range === null) {
            return new DayWeightsData;
        }

        /** @var Collection<string, int> $all */
        $all = collect();
        /** @var Collection<string, Collection<string, int>> $projects */
        $projects = collect();
        foreach ($this->workTime->projectWorkedSecondsByDay($companyId, $range->from, $range->to) as $worked) {
            $seconds = (int) $worked->duration_seconds;
            if ($seconds <= 0) {
                continue;
            }
            $day = Carbon::createFromTimestamp((int) $worked->day_start, $range->from->getTimezone())->toDateString();
            $all->put($day, $all->get($day, 0) + $seconds);
            $days = $projects->get((string) $worked->project_id, collect());
            $days->put($day, $days->get($day, 0) + $seconds);
            $projects->put((string) $worked->project_id, $days);
        }

        return new DayWeightsData($all, $projects);
    }

    /**
     * Находит полный период операций указанного метода; пустой результат отменяет запрос к базе весов.
     *
     * @param  Collection<int, Finance>  $finances
     */
    private function coveredRangeForMethod(Collection $finances, Method $method, string $timezone): ?DistributionPeriodData
    {
        /** @var Collection<int, DistributionPeriodData> $periods */
        $periods = $finances->filter(fn (Finance $finance): bool => $finance->distributionMethod() === $method)
            ->map(fn (Finance $finance): DistributionPeriodData => DistributionPeriodData::fromFinance($finance, $timezone));

        return $periods->isEmpty() ? null : new DistributionPeriodData(
            $periods->min('from')->copy(), $periods->max('to')->copy(),
        );
    }
}
