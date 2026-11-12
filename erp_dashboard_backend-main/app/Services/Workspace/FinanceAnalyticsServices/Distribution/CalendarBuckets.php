<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution;

use App\Enums\FinanceAnalyticsGranularity;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class CalendarBuckets
{
    /**
     * Пустые интервалы остаются в графике, чтобы отсутствие операций не сдвигало шкалу.
     *
     * @return Collection<string, array{date: string, label: string}>
     */
    public function emptyHistogram(Carbon $from, Carbon $to, FinanceAnalyticsGranularity $granularity): Collection
    {
        /** @var Collection<string, array{date: string, label: string}> $histogram */
        $histogram = collect();
        $cursor = $this->bucketStart($from, $granularity);
        $last = $this->bucketStart($to, $granularity);

        while ($cursor->lte($last)) {
            $key = $cursor->toDateString();
            $histogram->put($key, ['date' => $key, 'label' => $this->bucketLabel($cursor, $granularity)]);
            $this->advanceBucket($cursor, $granularity);
        }

        return $histogram;
    }

    /** Единый ключ связывает дневное распределение с выбранным масштабом графика. */
    public function key(Carbon $date, FinanceAnalyticsGranularity $granularity): string
    {
        return $this->bucketStart($date, $granularity)->toDateString();
    }

    /** Использует календарные границы, чтобы соседние запросы одинаково группировали даты. */
    private function bucketStart(Carbon $date, FinanceAnalyticsGranularity $granularity): Carbon
    {
        $start = $date->copy()->startOfDay();

        return match ($granularity) {
            FinanceAnalyticsGranularity::WEEK => $start->startOfWeek(CarbonInterface::MONDAY),
            FinanceAnalyticsGranularity::MONTH => $start->startOfMonth(),
            FinanceAnalyticsGranularity::QUARTER => $start->firstOfQuarter(),
            FinanceAnalyticsGranularity::DAY => $start,
        };
    }

    /** Шаг по календарю учитывает разную длину месяцев и кварталов. */
    private function advanceBucket(Carbon $cursor, FinanceAnalyticsGranularity $granularity): void
    {
        match ($granularity) {
            FinanceAnalyticsGranularity::WEEK => $cursor->addWeek(),
            FinanceAnalyticsGranularity::MONTH => $cursor->addMonth(),
            FinanceAnalyticsGranularity::QUARTER => $cursor->addQuarter(),
            FinanceAnalyticsGranularity::DAY => $cursor->addDay(),
        };
    }

    /** Формирует подпись из той же границы, которая используется для группировки сумм. */
    private function bucketLabel(Carbon $start, FinanceAnalyticsGranularity $granularity): string
    {
        $shortMonths = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
        $fullMonths = ['', 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        $romanQuarters = ['', 'I', 'II', 'III', 'IV'];

        return match ($granularity) {
            FinanceAnalyticsGranularity::WEEK => $start->day.'–'.$start->copy()->endOfWeek(CarbonInterface::SUNDAY)->day.' '.$shortMonths[$start->month],
            FinanceAnalyticsGranularity::MONTH => $fullMonths[$start->month].' '.$start->year,
            FinanceAnalyticsGranularity::QUARTER => $romanQuarters[$start->quarter].' кв. '.$start->year,
            FinanceAnalyticsGranularity::DAY => $start->day.' '.$shortMonths[$start->month],
        };
    }
}
