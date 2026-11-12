<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Planned;

use App\Enums\FinanceType;
use App\Enums\PlannedExpenseFormula;
use App\Models\Finance;
use App\Models\PlannedExpense;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\PlannedExpenseRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionPeriodData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\DistributionWeightsService;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\PeriodDistributionService;
use App\Services\Workspace\FinanceAnalyticsServices\Planned\Data\PlannedExpensesData;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/** Формулы плановых расходов и их база дохода находятся в одном модуле. */
class PlannedAnalyticsService
{
    public function __construct(
        private readonly PlannedExpenseRepository $planned,
        private readonly FinanceAnalyticsOperationRepository $finances,
        private readonly DistributionWeightsService $weights,
        private readonly PeriodDistributionService $periods,
    ) {}

    /**
     * Рассчитывает только текущий период каждого активного правила: месяц, квартал, полугодие или год.
     * Фильтр аналитики затем отсекает дневную долю этого периода, поэтому годовой запрос не создаёт планы за прошлые периоды.
     */
    public function calculate(FinanceAnalyticsFiltersData $filters, string $companyId): PlannedExpensesData
    {
        /** @var Collection<string, int> $buckets */
        $buckets = collect();
        /** @var Collection<string, int> $articles */
        $articles = collect();
        /** @var Collection<string, int> $incomes */
        $incomes = collect();
        $today = now($filters->timezone)->startOfDay();

        foreach ($this->planned->active($companyId) as $expense) {
            [$from, $to] = $expense->calculation_period->bounds($today);
            $period = new DistributionPeriodData($from, $to);
            $amounts = $this->expenseBuckets($expense, $period, $filters, $companyId, $incomes);
            $amount = (int) $amounts->sum();
            if ($amount <= 0) {
                continue;
            }
            foreach ($amounts as $date => $value) {
                $buckets->put($date, $buckets->get($date, 0) + $value);
            }
            $id = (string) $expense->finance_article_id;
            $articles->put($id, $articles->get($id, 0) + $amount);
        }

        return new PlannedExpensesData($buckets, $articles);
    }

    /**
     * Считает фактический доход полного периода напрямую, чтобы процентный план не включил в свою базу плановые расходы.
     *
     * @param  Collection<int, string>  $articleIds
     */
    public function incomeForPeriod(Carbon $from, Carbon $to, string $companyId, Collection $articleIds): int
    {
        $finances = $this->finances->finances($companyId, $from, $to);
        $timezone = $from->getTimezone()->getName();
        $weights = $this->weights->buildForFinances($finances, $companyId, $timezone);

        return (int) $finances->filter(static fn (Finance $finance): bool => $finance->type === FinanceType::ENTRANCE
            && ($articleIds->isEmpty() || $articleIds->containsStrict((string) $finance->finance_article_id)))
            ->sum(fn (Finance $finance): int => (int) $this->periods->amountBuckets($finance, $from, $to, weights: $weights)->sum());
    }

    /**
     * Сначала рассчитывает сумму полного текущего периода, чтобы фильтр отчёта не менял размер самого плана.
     *
     * @param  Collection<string, int>  $incomes
     * @return Collection<string, int>
     */
    private function expenseBuckets(PlannedExpense $expense, DistributionPeriodData $period, FinanceAnalyticsFiltersData $filters, string $companyId, Collection $incomes): Collection
    {
        $income = null;
        if ($expense->formula === PlannedExpenseFormula::PERCENT_OF_INCOME) {
            /** @var Collection<int, string> $articleIds */
            $articleIds = collect($expense->income_article_ids ?? [])->map(strval(...))->unique()->sort()->values();
            $key = $period->from->toDateString().':'.$period->to->toDateString().':'.$articleIds->implode(',');
            if (! $incomes->has($key)) {
                $incomes->put($key, $this->incomeForPeriod($period->from, $period->to, $companyId, $articleIds));
            }
            $income = $incomes->get($key);
        }

        return $this->periods->evenlyDistributedBuckets(
            $period,
            $expense->calculateAmount($income),
            $filters->from,
            $filters->to,
            $filters->granularity,
        );
    }
}
