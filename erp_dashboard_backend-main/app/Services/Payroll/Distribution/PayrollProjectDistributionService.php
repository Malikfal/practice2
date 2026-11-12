<?php

namespace App\Services\Payroll\Distribution;

use App\Services\Payroll\Distribution\Data\PayrollProjectAllocation;
use App\Services\Payroll\Distribution\Data\ProportionalAmountPart;
use Illuminate\Support\Collection;

class PayrollProjectDistributionService
{
    /**
     * Распределяет сумму пропорционально переданным часам.
     *
     * При отсутствии весов возвращает одну сумму без проекта.
     *
     * @param  Collection<int, object>  $durations
     * @return Collection<int, PayrollProjectAllocation>
     */
    public function distribute(int $amount, Collection $durations): Collection
    {
        if ($amount <= 0) {
            return collect();
        }

        $totalSeconds = (int) $durations->sum('duration_seconds');
        if ($totalSeconds <= 0) {
            return collect([new PayrollProjectAllocation(projectId: null, amount: $amount)]);
        }

        $allocated = 0;
        $rows = $durations->values()->map(function (object $duration, int $index) use ($amount, $totalSeconds, &$allocated): ProportionalAmountPart {
            $raw = $amount * (int) $duration->duration_seconds / $totalSeconds;
            $base = (int) floor($raw);
            $allocated += $base;

            return new ProportionalAmountPart(
                index: $index,
                projectId: isset($duration->project_id) && (string) $duration->project_id !== ''
                    ? (string) $duration->project_id
                    : null,
                amount: $base,
                fraction: $raw - $base,
            );
        });

        // Распределяем остаток по строкам с наибольшей дробной частью.
        $remainder = $amount - $allocated;
        $ranked = $rows
            ->sortByDesc('fraction')
            ->values()
            ->map(static fn (ProportionalAmountPart $row, int $index): ProportionalAmountPart => $row
                ->withAmount($row->amount + ($index < $remainder ? 1 : 0)));

        return $ranked
            ->sortBy('index')
            ->map(static fn (ProportionalAmountPart $row): PayrollProjectAllocation => new PayrollProjectAllocation(
                projectId: $row->projectId,
                amount: $row->amount,
            ))
            ->filter(static fn (PayrollProjectAllocation $row): bool => $row->amount > 0)
            ->values();
    }
}
