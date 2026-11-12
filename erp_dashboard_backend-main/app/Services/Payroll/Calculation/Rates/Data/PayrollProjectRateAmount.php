<?php

namespace App\Services\Payroll\Calculation\Rates\Data;

use Illuminate\Support\Collection;

/** Начисление за часы проекта по отдельной ставке сотрудника. */
final readonly class PayrollProjectRateAmount
{
    /** @param Collection<int, object> $durations Часы проекта, по которым посчитана сумма. */
    public function __construct(
        public string $projectId,
        public int $rate,
        public int $seconds,
        public int $amount,
        public Collection $durations,
    ) {}
}
