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

class CompanyHourlyPayrollService extends EmployeeRatePayrollService
{
    public function type(): EmployeeRateType
    {
        return EmployeeRateType::COMPANY_HOURLY;
    }

    public function baseRate(EmployeeRate $rate): ?int
    {
        return $rate->company_hourly_rate;
    }

    public function defaultScope(): PayrollHoursScope
    {
        return PayrollHoursScope::COMPANY;
    }

    /**
     * Задана ли в срезе ставка за часы всей компании: базовая, расширенная или отдельные ставки проектов.
     */
    public function isConfigured(EmployeeRate $rate): bool
    {
        $setting = $this->settingForDate($rate);

        return $this->defaultRate($rate, $setting) > 0
            || ($setting?->isAdvanced && $setting->ranges->isNotEmpty())
            || ($setting?->projectRates->isNotEmpty() ?? false);
    }

    /**
     * Для ставки от часов компании учитывает все оплачиваемые часы компании за период.
     */
    public function durations(
        Company $company,
        User $_employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?PayrollRateSetting $_setting,
    ): Collection {
        return $this->payrollHours->company($company, $from, $to);
    }
}
