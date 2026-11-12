<?php

namespace App\Services\Payroll\Calculation\Rates;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollComponentType;
use App\Enums\PayrollHoursScope;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Calculation\Rates\Data\PayrollProjectRateAmount;
use App\Services\Payroll\Calculation\Rates\Types\EmployeeRatePayrollService;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class DailyEmployeeRatePayrollService
{
    /**
     * Считает за день один тип начисления: оклад, свои, подконтрольные или общие часы.
     *
     * Часы проектов с отдельной ставкой выделяются в собственные компоненты, чтобы
     * их сумма целиком попала на свой проект. Пустые и нулевые компоненты не возвращаются.
     *
     * @return Collection<int, CalculatedPayrollComponent>
     */
    public function components(
        EmployeeRatePayrollService $rateService,
        Company $company,
        User $employee,
        EmployeeRate $rate,
        CarbonInterface $day,
    ): Collection {
        // Конкретный rateService знает, из какого поля/настройки брать ставку и часы.
        $setting = $rateService->settingForDate($rate);
        $baseRate = $rateService->defaultRate($rate, $setting);
        $projectRates = $setting?->projectRatesById() ?? collect();

        if ($baseRate <= 0 && $projectRates->isEmpty()) {
            return collect();
        }

        $from = $day->copy()->startOfDay();
        $to = $day->copy()->addDay()->startOfDay();
        $durations = $rateService->durations($company, $employee, $from, $to, $setting);
        $regularDurations = PayrollProjectRateHours::regular($durations, $projectRates);
        $type = PayrollComponentType::fromRateType($rateService->type());
        // Оклад распределяется по рабочим дням, почасовые ставки умножаются на секунды.
        $amount = $rateService->type() === EmployeeRateType::WEEKLY_SALARY
            ? PayrollAmount::weeklySalaryForDay($baseRate, $day)
            : (int) $regularDurations->sum(
                static fn (object $duration): int => PayrollAmount::fromSeconds(
                    (int) $duration->duration_seconds,
                    $baseRate,
                ),
            );

        $components = collect();

        if ($amount > 0) {
            $components->push(new CalculatedPayrollComponent(
                $type,
                $amount,
                $from,
                $to,
                $regularDurations,
                salaryDistributionScope: $rateService->type() === EmployeeRateType::WEEKLY_SALARY
                    ? ($rate->salary_distribution_scope ?? PayrollHoursScope::COMPANY)
                    : null,
            ));
        }

        return $components
            ->merge(PayrollProjectRateHours::amounts($durations, $projectRates)
                ->map(static fn (PayrollProjectRateAmount $projectAmount): CalculatedPayrollComponent => new CalculatedPayrollComponent(
                    $type,
                    $projectAmount->amount,
                    $from,
                    $to,
                    $projectAmount->durations,
                )))
            ->values();
    }
}
