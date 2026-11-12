<?php

namespace Tests\Unit\Payroll;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Enums\PayrollComponentType;
use App\Models\Company;
use App\Models\Finance;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollFinanceRepository;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Calculation\Data\PayrollCalculationResult;
use App\Services\Payroll\Calculation\PayrollCalculationService;
use App\Services\Payroll\Distribution\PayrollComponentDistributionService;
use App\Services\Payroll\Distribution\PayrollProjectDistributionService;
use App\Services\Payroll\Finance\PayrollFinanceArticleService;
use App\Services\Payroll\Finance\PayrollFinancePreparationService;
use App\Services\Payroll\Hours\PayrollHoursService;
use App\Services\Payroll\Period\PayrollPeriod;
use App\Services\Payroll\Recalculation\CompanyPayrollRecalculationService;
use App\Services\Payroll\Recalculation\SplitWeekFinanceService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class CompanyPayrollRecalculationServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->uuid('default_salary_finance_article_id')->nullable();
            $table->uuid('default_fixed_absence_finance_article_id')->nullable();
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('salary_finance_article_id')->nullable();
            $table->string('status');
            $table->date('archived_at')->nullable();
            $table->timestamps();
        });
        Schema::create('finance', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('project_id')->nullable();
            $table->uuid('finance_article_id')->nullable();
            $table->uuid('employee_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->string('type');
            $table->string('source');
            $table->text('comment')->nullable();
            $table->date('dateOfPayment');
            $table->date('distribution_from')->nullable();
            $table->date('distribution_to')->nullable();
            $table->string('distribution_method')->nullable();
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company', 'status' => 'ACTIVE']);
        User::query()->create(['id' => 'employee', 'company_id' => 'company', 'status' => 'ACTIVE']);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('finance');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    /**
     * Проверяет полную и идемпотентную замену payroll-финансов компании.
     */
    public function test_recalculation_replaces_company_payroll_and_preserves_manual_finance(): void
    {
        $this->finance('daily', FinanceSource::PAYROLL_DAILY, 5000, '2026-08-10');
        $this->finance('old-recalculation', FinanceSource::PAYROLL_RECALCULATION, 2000, '2026-08-16');
        $this->finance('manual', FinanceSource::MANUAL, 900, '2026-08-12');
        $calculations = Mockery::mock(PayrollCalculationService::class);
        $calculations->shouldReceive('forPeriod')->twice()->andReturn($this->calculationResult(12000));
        $cache = Mockery::mock(FinanceAnalyticsCacheService::class);
        $cache->shouldReceive('invalidateCompany')->with('company')->twice();
        $service = $this->service($calculations, $cache);
        $period = new PayrollPeriod(
            from: Carbon::parse('2026-08-10'),
            to: Carbon::parse('2026-08-17'),
        );

        $first = $service->recalculate(Company::query()->findOrFail('company'), $period);
        $second = $service->recalculate(Company::query()->findOrFail('company'), $period);

        $this->assertSame(2, $first->deleted);
        $this->assertSame(1, $second->deleted);
        $this->assertSame(12000, Finance::query()->where('source', FinanceSource::PAYROLL_RECALCULATION)->sum('amount'));
        $this->assertDatabaseHas('finance', ['id' => 'manual', 'amount' => 900]);
        $this->assertDatabaseMissing('finance', ['id' => 'daily']);
        $this->assertDatabaseMissing('finance', ['id' => 'old-recalculation']);
    }

    public function test_recalculation_includes_archived_employees_in_historical_calculation(): void
    {
        User::query()->create([
            'id' => 'blocked-employee',
            'company_id' => 'company',
            'status' => 'BLOCKED',
            'archived_at' => '2026-08-15',
        ]);
        $calculations = Mockery::mock(PayrollCalculationService::class);
        $calculations->shouldReceive('forPeriod')
            ->once()
            ->withArgs(static fn (Company $company, User $employee): bool => $employee->id === 'employee')
            ->andReturn($this->calculationResult(12000));
        $calculations->shouldReceive('forPeriod')
            ->once()
            ->withArgs(static fn (Company $company, User $employee): bool => $employee->id === 'blocked-employee')
            ->andReturn(new PayrollCalculationResult(collect()));
        $cache = Mockery::mock(FinanceAnalyticsCacheService::class);
        $cache->shouldReceive('invalidateCompany')->once()->with('company');

        $result = $this->service($calculations, $cache)->recalculate(
            Company::query()->findOrFail('company'),
            new PayrollPeriod(
                from: Carbon::parse('2026-08-10'),
                to: Carbon::parse('2026-08-17'),
            ),
        );

        $this->assertSame(1, $result->employeesProcessed);
        $this->assertDatabaseMissing('finance', ['employee_id' => 'blocked-employee']);
    }

    /**
     * Проверяет вычитание уже закрытой части недели после границы месяца.
     */
    public function test_second_month_part_receives_remaining_full_week_amount(): void
    {
        $this->finance('september-part', FinanceSource::PAYROLL_RECALCULATION, 3000, '2026-09-30');
        $calculations = Mockery::mock(PayrollCalculationService::class);
        $calculations->shouldReceive('forPeriod')->once()->andReturn($this->calculationResult(10000));
        $cache = Mockery::mock(FinanceAnalyticsCacheService::class);
        $cache->shouldReceive('invalidateCompany')->once();
        $period = new PayrollPeriod(
            from: Carbon::parse('2026-10-01'),
            to: Carbon::parse('2026-10-05'),
        );

        $result = $this->service($calculations, $cache)
            ->recalculate(Company::query()->findOrFail('company'), $period);

        $this->assertSame(7000, $result->amount);
        $this->assertSame(10000, Finance::query()
            ->where('source', FinanceSource::PAYROLL_RECALCULATION)
            ->sum('amount'));
        $this->assertDatabaseHas('finance', [
            'amount' => 7000,
            'dateOfPayment' => '2026-10-04 00:00:00',
            'distribution_from' => '2026-10-01 00:00:00',
            'distribution_to' => '2026-10-04 00:00:00',
        ]);
    }

    /**
     * Проверяет вычитание первой части отдельно по каждому проекту.
     */
    public function test_second_month_part_preserves_full_week_project_distribution(): void
    {
        $this->finance(
            id: 'september-project-a',
            source: FinanceSource::PAYROLL_RECALCULATION,
            amount: 2000,
            date: '2026-09-30',
            projectId: 'project-a',
        );
        $calculations = Mockery::mock(PayrollCalculationService::class);
        $calculations->shouldReceive('forPeriod')->once()->andReturn(new PayrollCalculationResult(collect([
            new CalculatedPayrollComponent(
                type: PayrollComponentType::HOURLY,
                amount: 10000,
                periodFrom: Carbon::parse('2026-09-28'),
                periodTo: Carbon::parse('2026-10-05'),
                durations: collect([
                    (object) ['project_id' => 'project-a', 'duration_seconds' => 3600],
                    (object) ['project_id' => 'project-b', 'duration_seconds' => 3600],
                ]),
            ),
        ])));
        $cache = Mockery::mock(FinanceAnalyticsCacheService::class);
        $cache->shouldReceive('invalidateCompany')->once();

        $result = $this->service($calculations, $cache)->recalculate(
            Company::query()->findOrFail('company'),
            new PayrollPeriod(
                from: Carbon::parse('2026-10-01'),
                to: Carbon::parse('2026-10-05'),
            ),
        );

        $this->assertSame(8000, $result->amount);
        $this->assertDatabaseHas('finance', [
            'source' => FinanceSource::PAYROLL_RECALCULATION->value,
            'project_id' => 'project-a',
            'amount' => 3000,
        ]);
        $this->assertDatabaseHas('finance', [
            'source' => FinanceSource::PAYROLL_RECALCULATION->value,
            'project_id' => 'project-b',
            'amount' => 5000,
        ]);
    }

    /**
     * Проверяет, что смена проектных весов в выходные не создает доплату к окладу.
     */
    public function test_weekend_project_redistribution_does_not_increase_weekly_salary(): void
    {
        $this->finance(
            id: 'july-project-a',
            source: FinanceSource::PAYROLL_RECALCULATION,
            amount: 4000,
            date: '2026-07-31',
            projectId: 'project-a',
        );
        $this->finance(
            id: 'july-project-b',
            source: FinanceSource::PAYROLL_RECALCULATION,
            amount: 2000,
            date: '2026-07-31',
            projectId: 'project-b',
        );
        $calculations = Mockery::mock(PayrollCalculationService::class);
        $calculations->shouldReceive('forPeriod')->once()->andReturn(new PayrollCalculationResult(collect([
            new CalculatedPayrollComponent(
                type: PayrollComponentType::WEEKLY_SALARY,
                amount: 6000,
                periodFrom: Carbon::parse('2026-07-27'),
                periodTo: Carbon::parse('2026-08-03'),
                durations: collect([
                    (object) ['project_id' => 'project-a', 'duration_seconds' => 3600],
                    (object) ['project_id' => 'project-b', 'duration_seconds' => 3600],
                ]),
            ),
        ])));
        $cache = Mockery::mock(FinanceAnalyticsCacheService::class);
        $cache->shouldReceive('invalidateCompany')->once();

        $result = $this->service($calculations, $cache)->recalculate(
            Company::query()->findOrFail('company'),
            new PayrollPeriod(
                from: Carbon::parse('2026-08-01'),
                to: Carbon::parse('2026-08-03'),
            ),
        );

        $this->assertSame(0, $result->amount);
        $this->assertSame(6000, Finance::query()
            ->where('source', FinanceSource::PAYROLL_RECALCULATION)
            ->sum('amount'));
        $this->assertDatabaseMissing('finance', [
            'source' => FinanceSource::PAYROLL_RECALCULATION->value,
            'dateOfPayment' => '2026-08-02 00:00:00',
        ]);
    }

    private function service(
        PayrollCalculationService $calculations,
        FinanceAnalyticsCacheService $cache,
    ): CompanyPayrollRecalculationService {
        $articles = Mockery::mock(PayrollFinanceArticleService::class);
        $articles->shouldReceive('resolveId')->andReturn('salary-article');
        $hours = Mockery::mock(PayrollHoursService::class);

        return new CompanyPayrollRecalculationService(
            payrollRepository: new PayrollFinanceRepository,
            calculations: $calculations,
            distribution: new PayrollComponentDistributionService(
                new PayrollProjectDistributionService,
                $hours,
            ),
            financePreparation: new PayrollFinancePreparationService($articles),
            splitWeekFinance: new SplitWeekFinanceService(new PayrollProjectDistributionService),
            analyticsCache: $cache,
        );
    }

    private function calculationResult(int $amount): PayrollCalculationResult
    {
        return new PayrollCalculationResult(collect([
            new CalculatedPayrollComponent(
                type: PayrollComponentType::HOURLY,
                amount: $amount,
                periodFrom: Carbon::parse('2026-08-10'),
                periodTo: Carbon::parse('2026-08-17'),
                durations: collect([(object) [
                    'project_id' => 'project',
                    'duration_seconds' => 3600,
                ]]),
            ),
        ]));
    }

    private function finance(
        string $id,
        FinanceSource $source,
        int $amount,
        string $date,
        string $projectId = 'project',
    ): void {
        Finance::query()->create([
            'id' => $id,
            'company_id' => 'company',
            'project_id' => $projectId,
            'finance_article_id' => $source === FinanceSource::MANUAL ? null : 'salary-article',
            'employee_id' => 'employee',
            'amount' => $amount,
            'type' => FinanceType::EXPENDITURE,
            'source' => $source,
            'dateOfPayment' => $date,
        ]);
    }
}
