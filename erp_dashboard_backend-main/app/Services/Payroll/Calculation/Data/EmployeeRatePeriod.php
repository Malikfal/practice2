<?php

namespace App\Services\Payroll\Calculation\Data;

use App\Models\EmployeeRate;
use Carbon\Carbon;

/** Интервал внутри расчета, на котором действует один срез ставки сотрудника. */
final readonly class EmployeeRatePeriod
{
    public function __construct(
        public EmployeeRate $rate,
        public Carbon $from,
        public Carbon $to,
    ) {}
}
