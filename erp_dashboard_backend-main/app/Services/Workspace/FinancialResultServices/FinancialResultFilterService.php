<?php

namespace App\Services\Workspace\FinancialResultServices;

use App\Enums\FinanceAnalyticsGranularity;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultFiltersData;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/** Нормализует входные параметры отчёта в единый типизированный набор. */
final class FinancialResultFilterService
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function fromArray(
        array $data,
        ?Carbon $defaultFrom = null,
        ?Carbon $defaultTo = null,
        string $timezone = 'Europe/Moscow',
    ): FinancialResultFiltersData {
        [$from, $to] = $this->period($data, $defaultFrom, $defaultTo, $timezone);

        return new FinancialResultFiltersData(
            from: $from,
            to: $to,
            granularity: FinanceAnalyticsGranularity::tryFrom(strtolower((string) ($data['granularity'] ?? '')))
                ?? FinanceAnalyticsGranularity::MONTH,
            timezone: $timezone,
            projectIds: $this->values($data['project_ids'] ?? []),
            clientIds: $this->values($data['client_ids'] ?? []),
            managerIds: $this->values($data['manager_ids'] ?? []),
            articleIds: $this->values($data['finance_article_ids'] ?? []),
            sources: $this->values($data['sources'] ?? []),
            employeeIds: $this->values($data['employee_ids'] ?? []),
        );
    }

    /**
     * Период включает обе границы. Обратный диапазон разворачивается так же, как в аналитике.
     *
     * @param  array<string, mixed>  $data
     * @return array{0: Carbon, 1: Carbon}
     */
    private function period(array $data, ?Carbon $defaultFrom, ?Carbon $defaultTo, string $timezone): array
    {
        $from = isset($data['from'])
            ? Carbon::parse($data['from'], $timezone)->startOfDay()
            : ($defaultFrom ?? now($timezone))->copy()->setTimezone($timezone)->startOfDay();
        $to = isset($data['to'])
            ? Carbon::parse($data['to'], $timezone)->endOfDay()
            : ($defaultTo ?? now($timezone))->copy()->setTimezone($timezone)->endOfDay();

        return $to->lessThan($from)
            ? [$to->copy()->startOfDay(), $from->copy()->endOfDay()]
            : [$from, $to];
    }

    /** @return Collection<int, string> */
    private function values(mixed $values): Collection
    {
        return collect(is_array($values) ? $values : [])
            ->map(static fn (mixed $value): string => trim((string) $value))
            ->filter()
            ->unique()
            ->sort()
            ->values();
    }
}
