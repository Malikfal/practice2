<?php

namespace Tests\Unit\Console;

use App\Models\Company;
use App\Services\Payroll\Accrual\DailyPayrollAccrualService;
use App\Services\Payroll\Period\PayrollPeriod;
use App\Services\Payroll\Recalculation\CompanyPayrollRecalculationService;
use App\Services\Payroll\Recalculation\Data\PayrollRecalculationResult;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class AccrueDailyPayrollCommandTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_default_accrual_date_is_yesterday_in_payroll_timezone(): void
    {
        config()->set('payroll.timezone', 'Europe/Moscow');
        config()->set('app.timezone', 'Europe/Moscow');
        Carbon::setTestNow(Carbon::parse('2026-09-01 21:05:00', 'UTC'));

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->boolean('calculate_daily_payroll')->default(false);
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
        Company::query()->create([
            'id' => 'company',
            'status' => 'ACTIVE',
            'calculate_daily_payroll' => true,
            'timezone' => 'Europe/Moscow',
        ]);

        $accruals = Mockery::mock(DailyPayrollAccrualService::class);
        $accruals->shouldReceive('accrueForCompany')
            ->once()
            ->withArgs(static fn (Company $company, CarbonInterface $date, bool $dryRun): bool => $company->id === 'company'
                && $date->toDateString() === '2026-09-01'
                && $date->timezoneName === 'Europe/Moscow'
                && $dryRun)
            ->andReturn([
                'date' => '2026-09-01',
                'companies_processed' => 1,
                'employees_processed' => 0,
                'rows_calculated' => 0,
                'finance_created' => 0,
                'finance_skipped_existing' => 0,
                'warnings' => [],
            ]);
        $this->app->instance(DailyPayrollAccrualService::class, $accruals);

        try {
            $this->artisan('payroll:accrue-daily', ['--dry-run' => true])
                ->assertSuccessful();
        } finally {
            Schema::dropIfExists('companies');
        }
    }

    public function test_due_daily_accrual_only_processes_companies_at_local_midnight_five(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-01 21:05:00', 'UTC'));

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->boolean('calculate_daily_payroll')->default(false);
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
        DB::table('companies')->insert([
            [
                'id' => 'moscow-company',
                'status' => 'ACTIVE',
                'calculate_daily_payroll' => true,
                'timezone' => 'Europe/Moscow',
            ],
            [
                'id' => 'new-york-company',
                'status' => 'ACTIVE',
                'calculate_daily_payroll' => true,
                'timezone' => 'America/New_York',
            ],
        ]);

        try {
            $accruals = Mockery::mock(DailyPayrollAccrualService::class);
            $accruals->shouldReceive('accrueForCompany')
                ->once()
                ->withArgs(static fn (Company $company, CarbonInterface $date, bool $dryRun): bool => $company->id === 'moscow-company'
                    && $date->toDateString() === '2026-09-01'
                    && $date->timezoneName === 'Europe/Moscow'
                    && $dryRun)
                ->andReturn([
                    'date' => '2026-09-01',
                    'companies_processed' => 1,
                    'employees_processed' => 0,
                    'rows_calculated' => 0,
                    'finance_created' => 0,
                    'finance_skipped_existing' => 0,
                    'warnings' => [],
                ]);
            $this->app->instance(DailyPayrollAccrualService::class, $accruals);

            $this->artisan('payroll:accrue-daily', ['--due' => true, '--dry-run' => true])
                ->assertSuccessful();
        } finally {
            Schema::dropIfExists('companies');
        }
    }

    public function test_default_recalculation_period_closes_yesterday_in_payroll_timezone(): void
    {
        config()->set('payroll.timezone', 'Europe/Moscow');
        config()->set('app.timezone', 'Europe/Moscow');
        Carbon::setTestNow(Carbon::parse('2026-09-06 21:20:00', 'UTC'));

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->timestamps();
        });
        DB::table('companies')->insert([
            'id' => 'company',
            'status' => 'ACTIVE',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        try {
            $capturedPeriod = null;
            $recalculations = Mockery::mock(CompanyPayrollRecalculationService::class);
            $recalculations->shouldReceive('recalculate')
                ->once()
                ->andReturnUsing(static function (object $company, PayrollPeriod $period) use (&$capturedPeriod): PayrollRecalculationResult {
                    $capturedPeriod = $period;

                    return new PayrollRecalculationResult(
                        period: $period,
                        employeesProcessed: 0,
                        amount: 0,
                        deleted: 0,
                        created: 0,
                    );
                });
            $this->app->instance(CompanyPayrollRecalculationService::class, $recalculations);

            $this->artisan('payroll:recalculate-period')->assertSuccessful();

            $this->assertSame('2026-09-01', $capturedPeriod?->from->toDateString());
            $this->assertSame('2026-09-06', $capturedPeriod?->paymentDate()->toDateString());
            $this->assertSame('Europe/Moscow', $capturedPeriod?->from->timezoneName);
        } finally {
            Schema::dropIfExists('companies');
        }
    }

    public function test_due_recalculation_only_processes_companies_at_local_midnight_thirty(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-06 21:30:00', 'UTC'));

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
        DB::table('companies')->insert([
            [
                'id' => 'moscow-company',
                'status' => 'ACTIVE',
                'timezone' => 'Europe/Moscow',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'new-york-company',
                'status' => 'ACTIVE',
                'timezone' => 'America/New_York',
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        try {
            $recalculations = Mockery::mock(CompanyPayrollRecalculationService::class);
            $recalculations->shouldReceive('recalculate')
                ->once()
                ->withArgs(static fn (object $company, PayrollPeriod $period): bool => $company->id === 'moscow-company'
                    && $period->from->timezoneName === 'Europe/Moscow')
                ->andReturnUsing(static fn (object $company, PayrollPeriod $period): PayrollRecalculationResult => new PayrollRecalculationResult(
                    period: $period,
                    employeesProcessed: 0,
                    amount: 0,
                    deleted: 0,
                    created: 0,
                ));
            $this->app->instance(CompanyPayrollRecalculationService::class, $recalculations);

            $this->artisan('payroll:recalculate-period', ['--due' => true])->assertSuccessful();
        } finally {
            Schema::dropIfExists('companies');
        }
    }

    public function test_due_commands_select_all_eligible_companies_before_starting_calculations(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->boolean('calculate_daily_payroll')->default(false);
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });

        $companyRows = array_map(static fn (int $index): array => [
            'id' => sprintf('company-%04d', $index),
            'status' => 'ACTIVE',
            'calculate_daily_payroll' => true,
            'timezone' => 'Europe/Moscow',
        ], range(0, 1000));

        foreach (array_chunk($companyRows, 500) as $chunk) {
            DB::table('companies')->insert($chunk);
        }

        try {
            Carbon::setTestNow(Carbon::parse('2026-09-01 21:05:00', 'UTC'));
            $companyChanged = false;
            $accruals = Mockery::mock(DailyPayrollAccrualService::class);
            $accruals->shouldReceive('accrueForCompany')
                ->times(1001)
                ->andReturnUsing(static function () use (&$companyChanged): array {
                    if (! $companyChanged) {
                        DB::table('companies')->where('id', 'company-1000')->update(['timezone' => 'America/New_York']);
                        $companyChanged = true;
                    }

                    return [
                        'date' => '2026-09-01',
                        'companies_processed' => 1,
                        'employees_processed' => 0,
                        'rows_calculated' => 0,
                        'finance_created' => 0,
                        'finance_skipped_existing' => 0,
                        'warnings' => [],
                    ];
                });
            $this->app->instance(DailyPayrollAccrualService::class, $accruals);

            $recalculations = Mockery::mock(CompanyPayrollRecalculationService::class);
            $recalculations->shouldReceive('recalculate')
                ->times(1001)
                ->andReturnUsing(static function (Company $company, PayrollPeriod $period) use (&$companyChanged): PayrollRecalculationResult {
                    if (! $companyChanged) {
                        DB::table('companies')->where('id', 'company-1000')->update(['timezone' => 'America/New_York']);
                        $companyChanged = true;
                    }

                    return new PayrollRecalculationResult(
                        period: $period,
                        employeesProcessed: 0,
                        amount: 0,
                        deleted: 0,
                        created: 0,
                    );
                });
            $this->app->instance(CompanyPayrollRecalculationService::class, $recalculations);

            $this->artisan('payroll:accrue-daily', ['--due' => true, '--dry-run' => true])
                ->assertSuccessful();

            DB::table('companies')->where('id', 'company-1000')->update(['timezone' => 'Europe/Moscow']);

            Carbon::setTestNow(Carbon::parse('2026-09-06 21:30:00', 'UTC'));
            $companyChanged = false;

            $this->artisan('payroll:recalculate-period', ['--due' => true])
                ->assertSuccessful();
        } finally {
            Schema::dropIfExists('companies');
        }
    }
}
