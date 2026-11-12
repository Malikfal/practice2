<?php

namespace App\Services\Payroll\Recalculation\Data;

use App\Services\Payroll\Period\PayrollPeriod;

/** Сводный результат полного перерасчета компании за один payroll-период. */
final readonly class PayrollRecalculationResult
{
    public function __construct(
        public PayrollPeriod $period,
        public int $employeesProcessed,
        public int $amount,
        public int $deleted,
        public int $created,
    ) {}
}
