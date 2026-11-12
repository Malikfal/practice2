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

class WeeklySalaryPayrollService extends EmployeeRatePayrollService
{
    public function type(): EmployeeRateType
    {
        return EmployeeRateType::WEEKLY_SALARY;
    }

    public function baseRate(EmployeeRate $rate): ?int
    {
        return $rate->salary;
    }

    public function defaultScope(): PayrollHoursScope
    {
        return PayrollHoursScope::COMPANY;
    }

    /**
     * Для недельного оклада выбирает часы по настроенному scope.
     */
    public function durations(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?PayrollRateSetting $setting,
    ): Collection {
        return match ($this->scopeFromSetting($setting)) {
            PayrollHoursScope::OWN => $this->payrollHours->own($company, $employee, $from, $to),
            PayrollHoursScope::SUPERVISED => $this->payrollHours->supervised($company, $employee, $from, $to),
            PayrollHoursScope::COMPANY => $this->payrollHours->company($company, $from, $to),
        };
    }
}
