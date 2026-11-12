<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution;

use App\Enums\FinanceAnalyticsGranularity;
use App\Enums\FinanceArticleDistributionMethod as Method;
use App\Models\Finance;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionPeriodData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/** Распределение одной суммы по времени; не загружает данные и не меняет модель. */
class PeriodDistributionService
{
    public function __construct(
        private readonly AmountAllocator $allocator,
        private readonly CalendarBuckets $calendar,
    ) {}

    /**
     * Сначала округляется весь период, затем выбираются дни отчёта.
     * пример:
     * [
     *   '2026-08-01' => 1000,
     *   '2026-08-02' => 1000,
     * ]
     *
     * @return Collection<string, int>
     */
    public function amountBuckets(
        Finance $finance,
        Carbon $from,
        Carbon $to,
        FinanceAnalyticsGranularity $granularity = FinanceAnalyticsGranularity::DAY,
        DistributionWeightsData $weights = new DistributionWeightsData,
    ): Collection {
        $period = DistributionPeriodData::fromFinance($finance, $from->getTimezone()->getName());
        $method = $finance->distributionMethod();
        /** @var Collection<string, int> $days */
        $days = match ($method) {
            Method::PROPORTIONAL_TO_EXPENSES => $weights->expenses->weightsForFinance($finance),
            Method::BY_VOLUME => $weights->volume->weightsForFinance($finance),
            default => collect(),
        };

        if ($period->isSingleDay() || $method === Method::BY_TERM) {
            return $this->evenlyDistributedBuckets($period, $finance->amount, $from, $to, $granularity);
        }

        $days = $this->weightsWithinFinancePeriod($days, $period);

        // Отсутствие исходных весов не должно удалять платёж из финансовых итогов.
        return $days->isEmpty()
            ? $this->evenlyDistributedBuckets($period, $finance->amount, $from, $to, $granularity)
            : $this->visibleBuckets($this->allocator->allocate($finance->amount, $days), $from, $to, $granularity);
    }

    /**
     * Фиксированная сумма относится ко всему периоду, даже если запрошена его часть.
     *
     * @return Collection<string, int>
     */
    public function evenlyDistributedBuckets(
        DistributionPeriodData $period,
        int $amount,
        Carbon $from,
        Carbon $to,
        FinanceAnalyticsGranularity $granularity,
    ): Collection {
        if ($amount <= 0 || $period->to->lt($from) || $period->from->gt($to)) {
            return collect();
        }

        /** @var Collection<string, int> $days */
        $days = collect();
        for ($day = $period->from->copy()->startOfDay(); $day->lte($period->to); $day->addDay()) {
            $days->put($day->toDateString(), 1);
        }

        return $this->visibleBuckets($this->allocator->allocate($amount, $days), $from, $to, $granularity);
    }

    /**
     * Диагностика использует ту же базу, что и расчёт, но не зависит от округлённой суммы.
     *
     * @return array{finance_id: string, article_id: string|null, article_name: string|null, distribution_method: string, reason: string}|null
     */
    public function missingWeightsWarning(Finance $finance, DistributionWeightsData $weights, string $timezone): ?array
    {
        $period = DistributionPeriodData::fromFinance($finance, $timezone);
        $method = $finance->distributionMethod();
        if ($period->isSingleDay() || $method === Method::BY_TERM) {
            return null;
        }

        $days = ($method === Method::PROPORTIONAL_TO_EXPENSES ? $weights->expenses : $weights->volume)->weightsForFinance($finance);
        if ($this->weightsWithinFinancePeriod($days, $period)->isNotEmpty()) {
            return null;
        }

        return [
            'finance_id' => (string) $finance->id,
            'article_id' => $finance->finance_article_id ?: null,
            'article_name' => $finance->article?->name ?: null,
            'distribution_method' => $method->value,
            'reason' => $method === Method::PROPORTIONAL_TO_EXPENSES ? 'NO_EXPENSES' : 'NO_WORK_HOURS',
        ];
    }

    /**
     * Дни вне операции не могут участвовать ни в расчёте, ни в проверке наличия весов.
     *
     * @param  Collection<string, int>  $days
     * @return Collection<string, int>
     */
    private function weightsWithinFinancePeriod(Collection $days, DistributionPeriodData $period): Collection
    {
        return $days->filter(static fn ($weight, $day): bool => $weight > 0
            && $day >= $period->from->toDateString() && $day <= $period->to->toDateString());
    }

    /**
     * Группировка после округления сохраняет одни суммы при любом масштабе графика.
     *
     * @param  Collection<string, int>  $days
     * @return Collection<string, int>
     */
    private function visibleBuckets(Collection $days, Carbon $from, Carbon $to, FinanceAnalyticsGranularity $granularity): Collection
    {
        return $days->filter(static fn ($amount, $day): bool => $day >= $from->toDateString() && $day <= $to->toDateString())
            ->groupBy(fn ($amount, $day): string => $this->calendar->key(Carbon::parse($day, $from->getTimezone()), $granularity), preserveKeys: true)
            ->map(static fn (Collection $amounts): int => (int) $amounts->sum());
    }
}
