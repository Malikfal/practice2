<?php

namespace Tests\Unit\Payroll;

use App\Models\Company;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollFinanceRepository;
use App\Services\Payroll\Accrual\DailyPayrollAccrualService;
use App\Services\Payroll\Calculation\Data\PayrollCalculationResult;
use App\Services\Payroll\Calculation\PayrollCalculationService;
use App\Services\Payroll\Distribution\PayrollComponentDistributionService;
use App\Services\Payroll\Finance\PayrollFinancePreparationService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class DailyPayrollAccrualServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->boolean('calculate_daily_payroll')->default(false);
            $table->uuid('default_salary_finance_article_id')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('status');
            $table->date('archived_at')->nullable();
            $table->timestamps();
        });

        Company::query()->create([
            'id' => 'company',
            'status' => 'ACTIVE',
            'calculate_daily_payroll' => true,
        ]);
        User::query()->create(['id' => 'active', 'company_id' => 'company', 'status' => 'ACTIVE']);
        User::query()->create([
            'id' => 'blocked',
            'company_id' => 'company',
            'status' => 'BLOCKED',
            'archived_at' => '2026-08-31',
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_daily_accrual_calculates_active_and_archived_employees(): void
    {
        $calculations = Mockery::mock(PayrollCalculationService::class);
        $calculations->shouldReceive('forDay')
            ->twice()
            ->withArgs(static fn (Company $company, User $employee, Carbon $day): bool => in_array(
                $employee->id,
                ['active', 'blocked'],
                true,
            ) && $day->isSameDay('2026-08-31'))
            ->andReturn(new PayrollCalculationResult(collect()));

        $service = new DailyPayrollAccrualService(
            payrollRepository: Mockery::mock(PayrollFinanceRepository::class),
            calculations: $calculations,
            distribution: Mockery::mock(PayrollComponentDistributionService::class),
            financePreparation: Mockery::mock(PayrollFinancePreparationService::class),
            analyticsCache: Mockery::mock(FinanceAnalyticsCacheService::class),
        );

        $summary = $service->accrueForCompany(
            Company::query()->findOrFail('company'),
            Carbon::parse('2026-08-31'),
            dryRun: true,
        );

        $this->assertSame(1, $summary['companies_processed']);
        $this->assertSame(0, $summary['employees_processed']);
    }
}
