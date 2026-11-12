<?php

namespace App\Events;

use App\Models\Company;
use App\Services\Payroll\Period\PayrollPeriod;
use Illuminate\Foundation\Events\Dispatchable;

/** Итоговые начисления компании за период заменены перерасчетом. */
final class PayrollPeriodRecalculated
{
    use Dispatchable;

    public function __construct(
        public readonly Company $company,
        public readonly PayrollPeriod $period,
    ) {}
}
