<?php

namespace Tests\Unit\Workspace;

use App\Enums\ProjectManagerPaymentMethod;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsWorkTimeRepository;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Repositories\Workspace\PayrollRepositories\PayrollPeriodRepository;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class FinanceAnalyticsWorkTimeRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...));
        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...));

        Schema::create('companies', fn (Blueprint $table) => $table->string('id')->primary());
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('manager_payment_method');
            $table->boolean('exclude_from_payroll')->default(false);
            $table->string('payroll_exclusion_scope')->nullable();
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
        });
        Schema::create('work_segments', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('task_id');
            $table->string('user_id');
            $table->unsignedBigInteger('started_at');
            $table->unsignedBigInteger('ended_at');
        });
        Schema::create('project_assignment_histories', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->string('user_id');
            $table->boolean('is_pm');
            $table->boolean('is_pm_payroll_enabled');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
        });
        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('employee_id');
            $table->date('effective_from');
        });
        Schema::create('project_payroll_excluded_employees', function (Blueprint $table): void {
            $table->string('project_id');
            $table->string('user_id');
        });
    }

    public function test_supervised_hours_follow_manager_payment_method_and_paid_pm_flag(): void
    {
        $from = Carbon::parse('2026-09-01')->startOfDay();
        $to = $from->copy()->addDays(3);
        DB::table('companies')->insert(['id' => 'company']);
        DB::table('users')->insert([
            ['id' => 'paid-a', 'company_id' => 'company', 'name' => 'Paid A'],
            ['id' => 'paid-b', 'company_id' => 'company', 'name' => 'Paid B'],
            ['id' => 'unpaid', 'company_id' => 'company', 'name' => 'Unpaid'],
        ]);
        DB::table('projects')->insert([
            'id' => 'project',
            'company_id' => 'company',
            'name' => 'Project',
            'manager_payment_method' => ProjectManagerPaymentMethod::ACCRUE_PROPORTIONALLY->value,
            'exclude_from_payroll' => false,
        ]);
        DB::table('tasks')->insert(['id' => 'task', 'project_id' => 'project']);
        DB::table('work_segments')->insert([
            [
                'id' => 'before-assignment',
                'task_id' => 'task',
                'user_id' => 'worker',
                'started_at' => $from->copy()->addHours(10)->timestamp,
                'ended_at' => $from->copy()->addHours(11)->timestamp,
            ],
            [
                'id' => 'after-assignment',
                'task_id' => 'task',
                'user_id' => 'worker',
                'started_at' => $from->copy()->addDay()->addHours(10)->timestamp,
                'ended_at' => $from->copy()->addDay()->addHours(11)->timestamp,
            ],
        ]);
        DB::table('project_assignment_histories')->insert([
            $this->assignment('paid-a', true),
            $this->assignment('paid-b', true),
            $this->assignment('unpaid', false),
        ]);

        $repository = $this->repository();
        $proportional = $repository->supervisedSeconds('company', $from, $to, collect())->keyBy('user_id');

        $this->assertSame(1800, $proportional['paid-a']->duration_seconds);
        $this->assertSame(1800, $proportional['paid-b']->duration_seconds);
        $this->assertFalse($proportional->has('unpaid'));

        DB::table('projects')->update(['manager_payment_method' => ProjectManagerPaymentMethod::ACCRUE_ALL->value]);
        $all = $repository->supervisedSeconds('company', $from, $to, collect())->keyBy('user_id');
        $this->assertSame(3600, $all['paid-a']->duration_seconds);
        $this->assertSame(3600, $all['paid-b']->duration_seconds);

        DB::table('projects')->update(['manager_payment_method' => ProjectManagerPaymentMethod::DO_NOT_ACCRUE->value]);
        $this->assertTrue($repository->supervisedSeconds('company', $from, $to, collect())->isEmpty());
    }

    /** @return array<string, mixed> */
    private function assignment(string $userId, bool $payrollEnabled): array
    {
        return [
            'id' => $userId,
            'project_id' => 'project',
            'user_id' => $userId,
            'is_pm' => true,
            'is_pm_payroll_enabled' => $payrollEnabled,
            'started_on' => '2026-09-02',
            'ended_on' => null,
        ];
    }

    private function repository(): FinanceAnalyticsWorkTimeRepository
    {
        $rates = Mockery::mock(EmployeeRateRepository::class);
        $rates->shouldReceive('excludedWorkerIds')->andReturn(collect());

        return new FinanceAnalyticsWorkTimeRepository($rates, new PayrollPeriodRepository);
    }
}
