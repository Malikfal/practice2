<?php

namespace App\Services\Payroll\Distribution\Data;

/** Часть рассчитанной суммы, распределенная на один проект или без проекта. */
final readonly class PayrollProjectAllocation
{
    public function __construct(
        public ?string $projectId,
        public int $amount,
    ) {}
}
