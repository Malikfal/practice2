<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Models\Company;
use App\Models\Finance;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Hours\PayrollHoursService;
use App\Services\Workspace\EmployeePayrollCalculationService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class EmployeePayrollCalculationServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('status');
            $table->string('timezone')->default('Europe/Moscow');
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->string('status');
            $table->date('archived_at')->nullable();
            $table->unsignedBigInteger('role_id')->nullable();
            $table->timestamps();
        });
        Schema::create('roles', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('name');
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
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company', 'status' => 'ACTIVE', 'timezone' => 'Asia/Yekaterinburg']);
        User::query()->create([
            'id' => 'employee',
            'company_id' => 'company',
            'status' => 'ACTIVE',
            'created_at' => '2026-08-10 00:00:00',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('finance');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_old_imported_finance_uses_recalculable_period_boundaries(): void
    {
        Carbon::setTestNow('2026-08-12 12:00:00');
        Finance::query()->create([
            'id' => 'saturday-import',
            'company_id' => 'company',
            'employee_id' => 'employee',
            'amount' => 12500,
            'type' => FinanceType::EXPENDITURE,
            'source' => FinanceSource::MANUAL,
            'dateOfPayment' => '2024-12-21',
        ]);
        $employee = User::query()->findOrFail('employee');

        $result = $this->service()->calculate($employee, $employee, ['per_page' => 200]);
        $importedFinanceRow = $result['rows']->first(
            static fn (array $row): bool => in_array('saturday-import', $row['finance_ids'], true),
        );

        $this->assertSame('2024-12-16', $result['from']);
        $this->assertSame('2024-12-16', $importedFinanceRow['period_from']);
        $this->assertSame('2024-12-22', $importedFinanceRow['period_to']);
        $this->assertSame(12500, $importedFinanceRow['amount_kopecks']);
    }

    public function test_report_passes_company_timezone_day_boundaries_to_payroll_hours(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-09-13 21:30:00', 'UTC'));
        $employee = User::query()->findOrFail('employee');

        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('rateForDate')->andReturnNull();
        $hours = Mockery::mock(PayrollHoursService::class);
        foreach (['own', 'supervised', 'company'] as $method) {
            $hours->shouldReceive($method)
                ->once()
                ->withArgs(static function (mixed ...$arguments): bool {
                    $from = $arguments[count($arguments) - 2];
                    $to = $arguments[count($arguments) - 1];

                    return $from instanceof CarbonInterface
                        && $to instanceof CarbonInterface
                        && $from->toDateTimeString() === '2026-09-07 00:00:00'
                        && $to->toDateTimeString() === '2026-09-14 00:00:00'
                        && $from->timezoneName === 'Asia/Yekaterinburg'
                        && $to->timezoneName === 'Asia/Yekaterinburg';
                })
                ->andReturn(collect());
        }
        $hours->shouldReceive('secondsByProjectType')->andReturn(collect());

        $result = (new EmployeePayrollCalculationService($repository, $hours))->calculate(
            $employee,
            $employee,
            ['from' => '2026-09-07', 'to' => '2026-09-13'],
        );

        $this->assertSame('2026-09-07', $result['from']);
        $this->assertSame('2026-09-13', $result['to']);
    }

    public function test_report_without_finances_starts_from_current_week_not_employee_creation(): void
    {
        Carbon::setTestNow('2026-09-10 12:00:00');
        $employee = User::query()->findOrFail('employee');

        $result = $this->service()->calculate($employee, $employee, []);

        $this->assertSame('2026-09-07', $result['from']);
        $this->assertSame('2026-09-13', $result['to']);
        $this->assertSame(1, $result['meta']['total']);
    }

    public function test_report_without_from_starts_from_first_finance_not_employee_creation(): void
    {
        Carbon::setTestNow('2026-09-13 12:00:00');
        Finance::query()->create([
            'id' => 'recent-finance',
            'company_id' => 'company',
            'employee_id' => 'employee',
            'amount' => 5000,
            'type' => FinanceType::EXPENDITURE,
            'source' => FinanceSource::MANUAL,
            'dateOfPayment' => '2026-09-10',
        ]);
        $employee = User::query()->findOrFail('employee');

        $result = $this->service()->calculate($employee, $employee, []);

        $this->assertSame('2026-09-07', $result['from']);
        $this->assertSame('2026-09-13', $result['to']);
        $this->assertSame(5000, $result['rows'][0]['amount_kopecks']);
    }

    public function test_company_report_groups_every_employee_under_each_paginated_period(): void
    {
        Carbon::setTestNow('2026-09-13 12:00:00');
        User::withBlocked()->create([
            'id' => 'blocked-employee',
            'company_id' => 'company',
            'status' => 'BLOCKED',
            'archived_at' => '2026-09-01',
            'created_at' => '2026-08-10 00:00:00',
        ]);
        Finance::query()->create([
            'id' => 'blocked-finance',
            'company_id' => 'company',
            'employee_id' => 'blocked-employee',
            'amount' => 2300,
            'type' => FinanceType::EXPENDITURE,
            'source' => FinanceSource::MANUAL,
            'dateOfPayment' => '2026-09-12',
        ]);
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 'actor', 'company_id' => 'company', 'status' => 'ACTIVE']);
        $actor->shouldReceive('can')->andReturnTrue();

        $result = $this->service()->calculateForCompany(
            $actor,
            Company::query()->findOrFail('company'),
            ['from' => '2026-09-01', 'to' => '2026-09-13', 'page' => 1, 'per_page' => 1],
        );

        $this->assertSame(1, $result['rows']->count());
        $this->assertSame(2, $result['meta']['total']);
        $this->assertSame('2026-09-07', $result['rows'][0]['period_from']);
        $employees = $result['rows'][0]['employees'];
        $this->assertSame(['blocked-employee'], $employees->pluck('employee.id')->all());
        $this->assertSame(2300, $employees[0]['calculation']['amount_kopecks']);
    }

    public function test_company_report_without_from_starts_from_first_employee_finance(): void
    {
        Carbon::setTestNow('2026-09-13 12:00:00');
        Finance::query()->create([
            'id' => 'company-finance',
            'company_id' => 'company',
            'employee_id' => 'employee',
            'amount' => 3100,
            'type' => FinanceType::EXPENDITURE,
            'source' => FinanceSource::MANUAL,
            'dateOfPayment' => '2026-09-11',
        ]);
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 'actor', 'company_id' => 'company', 'status' => 'ACTIVE']);
        $actor->shouldReceive('can')->andReturnTrue();

        $result = $this->service()->calculateForCompany(
            $actor,
            Company::query()->findOrFail('company'),
            [],
        );

        $this->assertSame('2026-09-07', $result['from']);
        $this->assertSame('2026-09-13', $result['to']);
        $this->assertSame(1, $result['meta']['total']);
    }

    private function service(): EmployeePayrollCalculationService
    {
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('rateForDate')->andReturnNull();
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('own')->andReturn(collect());
        $hours->shouldReceive('supervised')->andReturn(collect());
        $hours->shouldReceive('company')->andReturn(collect());
        $hours->shouldReceive('secondsByProjectType')->andReturn(collect());

        return new EmployeePayrollCalculationService($repository, $hours);
    }
}
