<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution;

use Illuminate\Support\Collection;

/**
 * Распределяет целочисленную денежную сумму по положительным весам без потери остатка.
 */
final class AmountAllocator
{
    /**
     * @param  Collection<int|string, int|float>  $weights
     * @return Collection<string, int>
     */
    public function allocate(int $amount, Collection $weights): Collection
    {
        $positiveWeights = $weights
            ->map(static fn (int|float $weight): float => max(0, (float) $weight))
            ->filter(static fn (float $weight): bool => $weight > 0);
        $totalWeight = $positiveWeights->sum();

        if ($amount <= 0 || $totalWeight <= 0) {
            return collect();
        }

        $allocated = 0;
        /** @var Collection<string, float> $fractions */
        $fractions = collect();
        $allocations = $positiveWeights->mapWithKeys(function (float $weight, int|string $id) use ($amount, $totalWeight, &$allocated, $fractions): array {
            $raw = $amount * $weight / $totalWeight;
            $base = (int) floor($raw);
            $key = (string) $id;
            $allocated += $base;
            $fractions->put($key, $raw - $base);

            return [$key => $base];
        });

        // Нераспределимые единицы остатка отдаются долям с наибольшей дробной частью.
        $fractions->sortDesc()->keys()->take($amount - $allocated)->each(
            static function (string $id) use ($allocations): void {
                $allocations->put($id, $allocations->get($id, 0) + 1);
            },
        );

        return $allocations;
    }
}
