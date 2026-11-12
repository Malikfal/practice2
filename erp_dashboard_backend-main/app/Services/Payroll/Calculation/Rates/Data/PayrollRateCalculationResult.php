<?php

namespace App\Services\Payroll\Calculation\Rates\Data;

use Illuminate\Support\Collection;

/** Результат применения одного типа ставки к его расчетным часам. */
final readonly class PayrollRateCalculationResult
{
    /**
     * @param  Collection<int, object>  $durations  Обычные часы, по которым посчитана amount.
     * @param  Collection<int, PayrollProjectRateAmount>  $projectAmounts  Начисления по отдельным ставкам проектов.
     */
    public function __construct(
        public int $amount,
        public Collection $durations,
        public Collection $projectAmounts = new Collection,
    ) {}
}
