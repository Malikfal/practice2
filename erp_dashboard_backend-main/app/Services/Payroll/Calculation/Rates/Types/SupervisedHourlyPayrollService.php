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

class SupervisedHourlyPayrollService extends EmployeeRatePayrollService
{
    public function type(): EmployeeRateType
    {
        return EmployeeRateType::SUPERVISED_HOURLY;
    }

    public function baseRate(EmployeeRate $rate): ?int
    {
        return $rate->supervised_hourly_rate;
    }

    public function defaultScope(): PayrollHoursScope
    {
        return PayrollHoursScope::SUPERVISED;
    }

    /**
     * Для PM-ставки учитывает часы проектов, где сотрудник назначен руководителем.
     */
    public function durations(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?PayrollRateSetting $_setting,
    ): Collection {
        return $this->payrollHours->supervised($company, $employee, $from, $to);
    }
}
