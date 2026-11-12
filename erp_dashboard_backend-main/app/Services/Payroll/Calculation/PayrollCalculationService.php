<?php

namespace App\Services\Payroll\Calculation;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollComponentType;
use App\Enums\PayrollHoursScope;
use App\Models\Company;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Absence\EmployeeAbsencePayrollService;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Calculation\Data\PayrollCalculationResult;
use App\Services\Payroll\Calculation\Rates\DailyEmployeeRatePayrollService;
use App\Services\Payroll\Calculation\Rates\Types\CompanyHourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\EmployeeRatePayrollService;
use App\Services\Payroll\Calculation\Rates\Types\HourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\SupervisedHourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\WeeklySalaryPayrollService;
use App\Services\Payroll\Calculation\Rates\WeeklyEmployeeRatePayrollService;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class PayrollCalculationService
{
    /** @var Collection<int, EmployeeRatePayrollService> */
    private Collection $rateServices;

    /**
     * Собирает сервисы четырех типов начислений в порядке их расчета:
     * оклад, собственные, подконтрольные и общие часы компании.
     */
    public function __construct(
        private readonly EmployeeRateRepository $rates,
        private readonly DailyEmployeeRatePayrollService $dailyPayroll,
        private readonly WeeklyEmployeeRatePayrollService $weeklyPayroll,
        private readonly EmployeeAbsencePayrollService $absencePayroll,
        WeeklySalaryPayrollService $weeklySalary,
        HourlyPayrollService $hourly,
        SupervisedHourlyPayrollService $supervisedHourly,
        CompanyHourlyPayrollService $companyHourly,
    ) {
        $this->rateServices = collect([$weeklySalary, $hourly, $supervisedHourly, $companyHourly]);
    }

    /**
     * Считает все компоненты начисления сотрудника за один день.
     */
    public function forDay(Company $company, User $employee, CarbonInterface $day): PayrollCalculationResult
    {
        // Фиксированное отсутствие полностью заменяет обычные начисления этого дня.
        $absence = $this->absencePayroll->fixedComponentForDay($employee, $day);
        if ($absence) {
            return new PayrollCalculationResult(collect([$absence]));
        }

        // Без действующей на день ставки сотруднику нечего рассчитывать.
        $rate = $this->rates->rateForDate($employee, $day);
        if (! $rate) {
            return new PayrollCalculationResult(collect());
        }

        // Каждый сервис создает независимые компоненты своего типа ставки.
        $components = $this->rateServices
            ->flatMap(fn (EmployeeRatePayrollService $service): Collection => $this->dailyPayroll
                ->components($service, $company, $employee, $rate, $day))
            ->values();

        return new PayrollCalculationResult($components);
    }

    /**
     * Считает компоненты сотрудника за период с учетом смен ставок и отсутствий.
     *
     * Границы from/to определяют дни, за которые создается сумма. Отдельные
     * formulaFrom/formulaTo определяют часы, по которым выбирается диапазон
     * расширенной формулы; обычно границы совпадают, а для второй части недели
     * после конца месяца формула смотрит на полную неделю.
     *
     * Порядок расчета:
     * 1. Фиксированные отсутствия превращаются в отдельные дневные компоненты.
     * 2. Период делится по effective_from ставок, чтобы каждый срез использовал
     *    действовавшие на нем значения и настройки.
     * 3. Из каждого среза исключаются дни фиксированных отсутствий, иначе за один день
     *    одновременно появились бы отсутствие и обычная зарплата.
     * 4. Каждый оставшийся интервал независимо считается четырьмя сервисами: оклад,
     *    свои часы, подконтрольные часы и часы всей компании. Часы проектов с отдельной
     *    ставкой дают отдельные компоненты того же типа.
     * 5. Сумма компонента относится только к from/to, а formulaFrom/formulaTo влияют
     *    только на выбор диапазона расширенной формулы.
     */
    public function forPeriod(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?CarbonInterface $formulaFrom = null,
        ?CarbonInterface $formulaTo = null,
    ): PayrollCalculationResult {
        $formulaFrom ??= $from;
        $formulaTo ??= $to;

        // Отсутствия сразу становятся самостоятельными компонентами начисления.
        $components = $this->absencePayroll->fixedComponentsForPeriod($employee, $from, $to);

        // Смена ставки внутри периода образует новый независимый расчетный срез.
        foreach ($this->rates->ratePeriodsForPeriod($employee, $from, $to) as $ratePeriod) {
            // Вырезаем из среза дни отсутствий: они уже начислены отдельными компонентами выше.
            foreach ($this->absencePayroll->payrollPeriodsExcludingFixedAbsences(
                $employee,
                $ratePeriod->from,
                $ratePeriod->to,
            ) as $payrollPeriod) {
                // Оклад и три почасовых типа считаются отдельно и не смешивают свои часы.
                foreach ($this->rateServices as $rateService) {
                    $calculation = $this->weeklyPayroll->calculateForPeriod(
                        $rateService,
                        $company,
                        $employee,
                        $ratePeriod->rate,
                        $payrollPeriod->from,
                        $payrollPeriod->to,
                        $formulaFrom,
                        $formulaTo,
                    );

                    if ($calculation === null) {
                        continue;
                    }

                    $type = PayrollComponentType::fromRateType($rateService->type());

                    // Сохраняем сумму вместе с ее часами и границами для последующего распределения.
                    if ($calculation->amount > 0) {
                        $components->push(new CalculatedPayrollComponent(
                            $type,
                            $calculation->amount,
                            $payrollPeriod->from,
                            $payrollPeriod->to,
                            $calculation->durations,
                            // Только окладу нужен отдельный scope часов для распределения по проектам.
                            salaryDistributionScope: $rateService->type() === EmployeeRateType::WEEKLY_SALARY
                                ? ($ratePeriod->rate->salary_distribution_scope ?? PayrollHoursScope::COMPANY)
                                : null,
                        ));
                    }

                    // Сумма по отдельной ставке проекта распределяется только на этот проект.
                    foreach ($calculation->projectAmounts as $projectAmount) {
                        $components->push(new CalculatedPayrollComponent(
                            $type,
                            $projectAmount->amount,
                            $payrollPeriod->from,
                            $payrollPeriod->to,
                            $projectAmount->durations,
                        ));
                    }
                }
            }
        }

        return new PayrollCalculationResult($components->values());
    }
}
