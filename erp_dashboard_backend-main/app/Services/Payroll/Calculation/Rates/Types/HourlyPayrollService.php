<?php

namespace App\Services\Payroll\Calculation\Rates\Types;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Services\Payroll\Calculation\Rates\PayrollRateSetting;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class HourlyPayrollService extends EmployeeRatePayrollService
{
    public function type(): EmployeeRateType
    {
        return EmployeeRateType::HOURLY;
    }

    public function baseRate(EmployeeRate $rate): ?int
    {
        return $rate->hourly_rate;
    }

    public function defaultScope(): PayrollHoursScope
    {
        return PayrollHoursScope::OWN;
    }

    /**
     * Для личной почасовой ставки учитывает только часы, затреканные самим сотрудником.
     */
    public function durations(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?PayrollRateSetting $_setting,
    ): Collection {
        return $this->payrollHours->own($company, $employee, $from, $to);
    }
}
