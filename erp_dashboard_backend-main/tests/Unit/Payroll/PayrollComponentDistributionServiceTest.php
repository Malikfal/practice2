<?php

namespace Tests\Unit\Payroll;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollHoursScope;
use App\Models\Company;
use App\Models\User;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Distribution\PayrollComponentDistributionService;
use App\Services\Payroll\Distribution\PayrollProjectDistributionService;
use App\Services\Payroll\Hours\PayrollHoursService;
use Carbon\Carbon;
use Mockery;
use Tests\TestCase;

class PayrollComponentDistributionServiceTest extends TestCase
{
    /**
     * Проверяет, что оклад использует часы заданного scope только за период компонента.
     */
    public function test_salary_uses_scope_hours_for_component_period(): void
    {
        $day = Carbon::parse('2026-08-26');
        $company = new Company(['id' => 'company']);
        $employee = new User(['id' => 'employee']);
        $component = new CalculatedPayrollComponent(
            PayrollComponentType::WEEKLY_SALARY,
            100,
            $day,
            $day->copy()->addDay(),
            collect(),
            salaryDistributionScope: PayrollHoursScope::COMPANY,
        );
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('company')
            ->once()
            ->with($company, $day, Mockery::on(
                static fn ($to): bool => $to->toDateString() === '2026-08-27',
            ))
            ->andReturn(collect([
                (object) ['project_id' => 'company-a', 'duration_seconds' => 1],
                (object) ['project_id' => 'company-b', 'duration_seconds' => 1],
            ]));

        $rows = (new PayrollComponentDistributionService(
            new PayrollProjectDistributionService,
            $hours,
        ))->distribute($component, $company, $employee);

        $this->assertSame(['company-a', 'company-b'], $rows->pluck('projectId')->all());
        $this->assertSame([50, 50], $rows->pluck('amount')->all());
    }

    /**
     * Проверяет, что фиксированное отсутствие всегда записывается без проекта.
     */
    public function test_fixed_absence_is_not_distributed_to_projects(): void
    {
        $day = Carbon::parse('2026-08-26');
        $component = new CalculatedPayrollComponent(
            PayrollComponentType::FIXED_ABSENCE,
            101,
            $day,
            $day->copy()->addDay(),
            collect(),
        );
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldNotReceive('own');
        $hours->shouldNotReceive('supervised');
        $hours->shouldNotReceive('company');

        $rows = (new PayrollComponentDistributionService(
            new PayrollProjectDistributionService,
            $hours,
        ))->distribute(
            $component,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
        );

        $this->assertSame([null], $rows->pluck('projectId')->all());
        $this->assertSame([101], $rows->pluck('amount')->all());
    }
}
