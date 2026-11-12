<?php

namespace Tests\Unit\Payroll;

use App\Enums\PayrollComponentType;
use App\Models\Company;
use App\Models\EmployeeAbsence;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Absence\EmployeeAbsencePayrollService;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Calculation\PayrollCalculationService;
use App\Services\Payroll\Calculation\Rates\DailyEmployeeRatePayrollService;
use App\Services\Payroll\Calculation\Rates\Types\CompanyHourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\HourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\SupervisedHourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\WeeklySalaryPayrollService;
use App\Services\Payroll\Calculation\Rates\WeeklyEmployeeRatePayrollService;
use Carbon\Carbon;
use Mockery;
use Tests\TestCase;

class PayrollCalculationServiceTest extends TestCase
{
    /**
     * Проверяет, что фиксированное отсутствие проходит через общий модуль расчета.
     */
    public function test_fixed_absence_is_returned_as_calculation_component(): void
    {
        $day = Carbon::parse('2026-08-24');
        $component = new CalculatedPayrollComponent(
            PayrollComponentType::FIXED_ABSENCE,
            5000,
            $day->copy(),
            $day->copy()->addDay(),
            collect(),
            new EmployeeAbsence(['id' => 'absence']),
        );
        $absences = Mockery::mock(EmployeeAbsencePayrollService::class);
        $absences->shouldReceive('fixedComponentForDay')->once()->andReturn($component);

        $service = new PayrollCalculationService(
            Mockery::mock(EmployeeRateRepository::class),
            Mockery::mock(DailyEmployeeRatePayrollService::class),
            Mockery::mock(WeeklyEmployeeRatePayrollService::class),
            $absences,
            Mockery::mock(WeeklySalaryPayrollService::class),
            Mockery::mock(HourlyPayrollService::class),
            Mockery::mock(SupervisedHourlyPayrollService::class),
            Mockery::mock(CompanyHourlyPayrollService::class),
        );

        $result = $service->forDay(
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $day,
        );

        $this->assertSame(5000, $result->totalAmount());
        $this->assertSame(PayrollComponentType::FIXED_ABSENCE, $result->components->first()->type);
    }
}
