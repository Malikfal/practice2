<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceType;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsCompanyRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsProjectRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsWorkTimeRepository;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/** Расчёт ФОТ относит расход сотрудника целиком к дате платежа, как финансовый результат. */
class FinanceAnalyticsEmployeeExpensesTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('ACTIVE');
        });
        Schema::create('finance', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('project_id')->nullable();
            $table->string('employee_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->string('type');
            $table->date('dateOfPayment');
            $table->date('distribution_from')->nullable();
            $table->date('distribution_to')->nullable();
            $table->string('distribution_method')->nullable();
        });

        DB::table('users')->insert(['id' => 'employee', 'name' => 'Мария', 'last_name' => 'Колупаева']);
        DB::table('finance')->insert([
            // Ручная доплата за месяц: дата платежа 27.09, распределение на весь сентябрь.
            $this->row('monthly-top-up', 1930800, '2026-09-27', '2026-09-01', '2026-09-30'),
            $this->row('week-payroll', 923048, '2026-09-27', '2026-09-21', '2026-09-27'),
            $this->row('day-payroll', 184615, '2026-10-01', '2026-10-01', '2026-10-01'),
            $this->row('project-payroll', 1000, '2026-09-29', null, null, projectId: 'project'),
            $this->row('income', 5000, '2026-09-29', null, null, type: FinanceType::ENTRANCE),
            $this->row('without-employee', 7000, '2026-09-29', null, null, employeeId: null),
            $this->row('other-company', 9000, '2026-09-29', null, null, companyId: 'other'),
        ]);

        $companies = Mockery::mock(FinanceAnalyticsCompanyRepository::class);
        $companies->shouldReceive('timezoneForCompany')->andReturn('Europe/Moscow');
        $projects = Mockery::mock(FinanceAnalyticsProjectRepository::class);
        $projects->shouldReceive('projectIds')->andReturnUsing(
            // Без фильтра репозиторий возвращает все проекты компании.
            static fn ($company, $projectIds) => collect($projectIds)->isEmpty()
                ? collect(['project'])
                : collect($projectIds)->intersect(['project'])->values(),
        );
        $workTime = Mockery::mock(FinanceAnalyticsWorkTimeRepository::class);
        $workTime->shouldReceive('employeeWorkedSeconds')->andReturn(collect());
        $workTime->shouldReceive('supervisedSeconds')->andReturn(collect());
        $this->app->instance(FinanceAnalyticsCompanyRepository::class, $companies);
        $this->app->instance(FinanceAnalyticsProjectRepository::class, $projects);
        $this->app->instance(FinanceAnalyticsWorkTimeRepository::class, $workTime);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('finance');
        Schema::dropIfExists('users');
        parent::tearDown();
    }

    public function test_distributed_payment_is_not_split_into_following_period(): void
    {
        $result = $this->employees('2026-09-28', '2026-09-30');

        $this->assertSame(1000, $result['summary']['expenses']);
        $this->assertSame(1000, $result['data'][0]['expenses']);
    }

    public function test_whole_amount_belongs_to_period_with_payment_date(): void
    {
        $result = $this->employees('2026-09-21', '2026-09-27');

        $this->assertSame(1930800 + 923048, $result['summary']['expenses']);
        $this->assertSame('Мария Колупаева', $result['data'][0]['employee']['name']);
        $this->assertSame(100.0, $result['data'][0]['percent']);
    }

    public function test_month_contains_only_employee_expenses_paid_in_it(): void
    {
        $result = $this->employees('2026-09-01', '2026-09-30');

        $this->assertSame(1930800 + 923048 + 1000, $result['summary']['expenses']);
    }

    public function test_project_filter_keeps_only_payments_of_selected_projects(): void
    {
        $result = $this->employees('2026-09-01', '2026-10-31', ['project_ids' => ['project']]);

        $this->assertSame(1000, $result['summary']['expenses']);
    }

    /** @return array<string, mixed> */
    private function employees(string $from, string $to, array $extra = []): array
    {
        return $this->app->make(FinanceAnalyticsService::class)
            ->employees(array_merge(['from' => $from, 'to' => $to], $extra), 'company');
    }

    /** @return array<string, mixed> */
    private function row(
        string $id,
        int $amount,
        string $paymentDate,
        ?string $distributionFrom,
        ?string $distributionTo,
        ?string $projectId = null,
        FinanceType $type = FinanceType::EXPENDITURE,
        ?string $employeeId = 'employee',
        string $companyId = 'company',
    ): array {
        return [
            'id' => $id,
            'company_id' => $companyId,
            'project_id' => $projectId,
            'employee_id' => $employeeId,
            'amount' => $amount,
            'type' => $type->value,
            'dateOfPayment' => $paymentDate,
            'distribution_from' => $distributionFrom,
            'distribution_to' => $distributionTo,
            'distribution_method' => 'BY_TERM',
        ];
    }
}
