<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Actual\Data;

use Illuminate\Support\Collection;

/** Законченный результат расчёта факта, независимый от формы отчёта. */
final readonly class ActualAnalyticsData
{
    /**
     * @param  Collection<int, FinanceAllocationData>  $allocations
     * @param  Collection<int, array<string, string|null>>  $warnings
     */
    public function __construct(public Collection $allocations, public Collection $warnings) {}
}
