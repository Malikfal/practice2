<?php

namespace Tests\Unit\Http;

use App\Http\Middleware\EnsureAccessToken;
use App\Http\Middleware\EnsureActiveSubscription;
use App\Http\Middleware\EnsureCompanyIsActive;
use App\Models\Company;
use App\Models\User;
use App\Services\Workspace\CompanyPayrollSummaryService;
use App\Services\Workspace\EmployeePayrollCalculationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class CompanyPayrollCalculationControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('status');
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('last_name')->nullable();
            $table->string('status');
            $table->date('archived_at')->nullable();
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company-a', 'status' => 'ACTIVE']);
        Company::query()->create(['id' => 'company-b', 'status' => 'ACTIVE']);

        $this->withoutMiddleware([
            EnsureAccessToken::class,
            EnsureCompanyIsActive::class,
            EnsureActiveSubscription::class,
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_returns_periods_with_all_company_employees(): void
    {
        $actor = $this->actor(true);
        $calculations = Mockery::mock(EmployeePayrollCalculationService::class);
        $calculations->shouldReceive('calculateForCompany')
            ->once()
            ->withArgs(static fn (User $user, Company $company, array $data): bool => $user->id === 'actor'
                && $company->id === 'company-a'
                && $data === ['from' => '2026-09-01', 'to' => '2026-09-13', 'page' => '2', 'per_page' => '5'])
            ->andReturn([
                'from' => '2026-09-01',
                'to' => '2026-09-13',
                'rows' => collect([
                    $this->period('2026-09-07', '2026-09-13'),
                    $this->period('2026-09-01', '2026-09-06'),
                ]),
                'meta' => ['current_page' => 2, 'last_page' => 3, 'per_page' => 5, 'total' => 11],
            ]);
        $this->app->instance(EmployeePayrollCalculationService::class, $calculations);

        $this->actingAs($actor)
            ->getJson('/api/employees/payroll-calculations?from=2026-09-01&to=2026-09-13&page=2&per_page=5')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 2)
            ->assertJsonPath('meta.total', 11)
            ->assertJsonPath('data.0.period_from', '2026-09-07')
            ->assertJsonPath('data.0.employees.0.employee.id', 'a-1')
            ->assertJsonPath('data.0.employees.1.employee.id', 'a-2')
            ->assertJsonPath('data.0.employees.0.employee.is_archived', false)
            ->assertJsonPath('data.0.employees.1.employee.is_archived', true)
            ->assertJsonPath('data.1.employees.1.calculation.amount_kopecks', 200)
            ->assertJsonCount(2, 'data')
            ->assertJsonCount(2, 'data.0.employees');
    }

    public function test_requires_salary_view_permission(): void
    {
        $actor = $this->actor(false);
        $calculations = Mockery::mock(EmployeePayrollCalculationService::class);
        $calculations->shouldNotReceive('calculateForCompany');
        $this->app->instance(EmployeePayrollCalculationService::class, $calculations);

        $this->actingAs($actor)
            ->getJson('/api/employees/payroll-calculations')
            ->assertForbidden();
    }

    public function test_summary_passes_filters_and_serializes_employees(): void
    {
        $actor = $this->actor(true);
        $summary = Mockery::mock(CompanyPayrollSummaryService::class);
        $summary->shouldReceive('summarize')
            ->once()
            ->withArgs(static fn (User $user, Company $company, array $data): bool => $company->id === 'company-a'
                && $data === ['from' => '2026-09-01', 'to' => '2026-09-30', 'group_by' => 'month'])
            ->andReturn([
                'from' => '2026-09-01',
                'to' => '2026-09-30',
                'group_by' => 'month',
                'totals' => ['amount_kopecks' => 100],
                'employees' => collect([[
                    'employee' => new User(['id' => 'a-1', 'name' => 'Анна Иванова', 'archived_at' => null]),
                    'own_seconds' => 3600,
                    'supervised_seconds' => 0,
                    'amount_kopecks' => 100,
                ]]),
                'groups' => collect([['key' => '2026-09', 'values' => []]]),
                'periods' => collect(),
            ]);
        $this->app->instance(CompanyPayrollSummaryService::class, $summary);

        $this->actingAs($actor)
            ->getJson('/api/employees/payroll-summary?from=2026-09-01&to=2026-09-30&group_by=month')
            ->assertOk()
            ->assertJsonPath('group_by', 'month')
            ->assertJsonPath('employees.0.id', 'a-1')
            ->assertJsonPath('employees.0.first_name', 'Анна')
            ->assertJsonPath('employees.0.is_archived', false)
            ->assertJsonPath('employees.0.own_seconds', 3600)
            ->assertJsonPath('groups.0.key', '2026-09');
    }

    public function test_summary_validates_period_and_grouping(): void
    {
        $actor = $this->actor(true);
        $summary = Mockery::mock(CompanyPayrollSummaryService::class);
        $summary->shouldNotReceive('summarize');
        $this->app->instance(CompanyPayrollSummaryService::class, $summary);

        $this->actingAs($actor)
            ->getJson('/api/employees/payroll-summary?from=2026-09-01')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['to']);
        $this->actingAs($actor)
            ->getJson('/api/employees/payroll-summary?group_by=day')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['group_by']);
        $this->actingAs($this->actor(false))
            ->getJson('/api/employees/payroll-summary')
            ->assertForbidden();
    }

    private function actor(bool $canViewSalary): User
    {
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 'actor', 'company_id' => 'company-a', 'status' => 'ACTIVE']);
        $actor->shouldReceive('can')->andReturn($canViewSalary);

        return $actor;
    }

    private function period(string $from, string $to): array
    {
        return [
            'period_from' => $from,
            'period_to' => $to,
            'employees' => collect(['a-1', 'a-2'])->map(static fn (string $id): array => [
                'employee' => new User([
                    'id' => $id,
                    'name' => $id,
                    'status' => $id === 'a-2' ? 'BLOCKED' : 'ACTIVE',
                    'archived_at' => $id === 'a-2' ? '2026-09-01' : null,
                ]),
                'calculation' => [
                    'period_from' => $from,
                    'period_to' => $to,
                    'amount_kopecks' => $id === 'a-2' ? 200 : 100,
                ],
            ]),
        ];
    }
}
