<?php

namespace App\Services\Workspace\FinanceAnalyticsServices;

use App\Enums\FinanceAnalyticsGranularity;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Нормализует входные фильтры финансовой аналитики.
 */
final class FinanceAnalyticsFilterService
{
    /**
     * Преобразует необязательные входные значения в типизированный набор фильтров.
     *
     * @param  array<string, mixed>  $data
     */
    public function fromArray(
        array $data,
        ?Carbon $defaultFrom = null,
        ?Carbon $defaultTo = null,
        string $timezone = 'Europe/Moscow',
    ): FinanceAnalyticsFiltersData {
        [$from, $to] = $this->period($data, $defaultFrom, $defaultTo, $timezone);

        return new FinanceAnalyticsFiltersData(
            from: $from,
            to: $to,
            granularity: $this->granularity($data['granularity'] ?? null),
            timezone: $timezone,
            projectIds: $this->ids($data['project_ids'] ?? []),
            clientIds: $this->ids($data['client_ids'] ?? []),
            managerIds: $this->ids($data['manager_ids'] ?? []),
        );
    }

    /**
     * Возвращает период с включёнными границами; обратный диапазон разворачивается.
     *
     * @param  array<string, mixed>  $data
     * @return array{0: Carbon, 1: Carbon}
     */
    public function period(array $data, ?Carbon $defaultFrom = null, ?Carbon $defaultTo = null, string $timezone = 'Europe/Moscow'): array
    {
        $from = isset($data['from'])
            ? Carbon::parse($data['from'], $timezone)->setTimezone($timezone)->startOfDay()
            : ($defaultFrom ?? now($timezone))->copy()->setTimezone($timezone)->startOfDay();
        $to = isset($data['to'])
            ? Carbon::parse($data['to'], $timezone)->setTimezone($timezone)->endOfDay()
            : ($defaultTo ?? now($timezone))->copy()->setTimezone($timezone)->endOfDay();

        return $to->lessThan($from)
            ? [$to->copy()->startOfDay(), $from->copy()->endOfDay()]
            : [$from, $to];
    }

    /**
     * Сортирует уникальные ID, чтобы одинаковый набор фильтров давал одинаковый ключ кеша независимо от порядка в запросе.
     *
     * @return Collection<int, string>
     */
    public function ids(mixed $values): Collection
    {
        return collect(is_array($values) ? $values : [])
            ->map(static fn (mixed $value): string => trim((string) $value))
            ->filter()
            ->unique()
            ->sort()
            ->values();
    }

    /** Возвращает поддерживаемую детализацию либо детализацию по месяцам. */
    private function granularity(mixed $value): FinanceAnalyticsGranularity
    {
        return FinanceAnalyticsGranularity::tryFrom(strtolower((string) $value))
            ?? FinanceAnalyticsGranularity::MONTH;
    }
}
