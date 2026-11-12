<?php

namespace App\Services\Payroll\Calculation\Rates;

use App\Services\Payroll\Calculation\Rates\Data\PayrollProjectRateAmount;
use Illuminate\Support\Collection;

/**
 * Делит часы на обычные и часы проектов с отдельной ставкой.
 *
 * Часы проектов с отдельной ставкой учитываются в диапазонах, но оплачиваются
 * по ставке проекта, поэтому обычная ставка применяется только к остальным часам.
 */
final class PayrollProjectRateHours
{
    /**
     * Возвращает часы проектов без отдельной ставки.
     *
     * @param  Collection<int, object>  $durations
     * @param  Collection<string, PayrollProjectRate>  $projectRates
     * @return Collection<int, object>
     */
    public static function regular(Collection $durations, Collection $projectRates): Collection
    {
        if ($projectRates->isEmpty()) {
            return $durations;
        }

        return $durations
            ->reject(static fn (object $duration): bool => $projectRates->has((string) ($duration->project_id ?? '')))
            ->values();
    }

    /**
     * Возвращает часы проектов с отдельной ставкой.
     *
     * @param  Collection<int, object>  $durations
     * @param  Collection<string, PayrollProjectRate>  $projectRates
     * @return Collection<int, object>
     */
    public static function project(Collection $durations, Collection $projectRates): Collection
    {
        if ($projectRates->isEmpty()) {
            return collect();
        }

        return $durations
            ->filter(static fn (object $duration): bool => $projectRates->has((string) ($duration->project_id ?? '')))
            ->values();
    }

    /**
     * Считает начисление по каждому проекту с отдельной ставкой.
     *
     * @param  Collection<int, object>  $durations
     * @param  Collection<string, PayrollProjectRate>  $projectRates
     * @return Collection<int, PayrollProjectRateAmount>
     */
    public static function amounts(Collection $durations, Collection $projectRates): Collection
    {
        return self::project($durations, $projectRates)
            ->groupBy(static fn (object $duration): string => (string) $duration->project_id)
            ->map(static function (Collection $projectDurations, string $projectId) use ($projectRates): PayrollProjectRateAmount {
                $rate = $projectRates->get($projectId)->rate;
                $seconds = (int) $projectDurations->sum('duration_seconds');

                return new PayrollProjectRateAmount(
                    projectId: $projectId,
                    rate: $rate,
                    seconds: $seconds,
                    amount: PayrollAmount::fromSeconds($seconds, $rate),
                    durations: $projectDurations->values(),
                );
            })
            ->filter(static fn (PayrollProjectRateAmount $amount): bool => $amount->amount > 0)
            ->values();
    }
}
