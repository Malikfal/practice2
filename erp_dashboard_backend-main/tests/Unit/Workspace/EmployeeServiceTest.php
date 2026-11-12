<?php

namespace Tests\Unit\Workspace;

use App\Enums\EmployeeRateType;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Repositories\Workspace\EmployeeRepository;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Repositories\Workspace\PayrollRepositories\PayrollDurationRepository;
use App\Services\Payroll\Calculation\Rates\Types\CompanyHourlyPayrollService;
use App\Services\Payroll\Hours\PayrollHoursService;
use App\Services\Workspace\EmployeeService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class EmployeeServiceTest extends TestCase
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
            $table->uuid('role_id')->nullable();
            $table->string('name')->nullable();
            $table->string('status');
            $table->timestamps();
        });
        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->unsignedBigInteger('salary')->nullable();
            $table->string('salary_distribution_scope')->nullable();
            $table->unsignedBigInteger('hourly_rate')->nullable();
            $table->unsignedBigInteger('supervised_hourly_rate')->nullable();
            $table->unsignedBigInteger('company_hourly_rate')->nullable();
            $table->boolean('exclude_from_supervised_hours')->default(false);
            $table->json('rate_settings')->nullable();
            $table->date('effective_from');
            $table->uuid('changed_by')->nullable();
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company', 'status' => 'ACTIVE', 'timezone' => 'Europe/Moscow']);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('employee_rates');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_company_hours_are_attached_only_to_employees_with_company_hourly_rate(): void
    {
        Carbon::setTestNow('2026-10-27 12:00:00');
        // Действующая ставка за часы компании.
        $this->rate('german', ['company_hourly_rate' => 50000], '2026-10-01');
        // Только почасовая ставка: часы компании не нужны.
        $this->rate('anna', ['hourly_rate' => 70000], '2026-10-01');
        // Ставка за часы компании начнёт действовать только завтра, а сегодня действует прежняя.
        $this->rate('boris', ['hourly_rate' => 70000], '2026-10-01');
        $this->rate('boris', ['company_hourly_rate' => 50000], '2026-10-28');
        // Расширенная ставка без базовой колонки тоже считается заданной.
        $this->rate('vera', ['rate_settings' => [[
            'rate_type' => EmployeeRateType::COMPANY_HOURLY->value,
            'is_advanced' => true,
            'default_rate' => 30000,
            'ranges' => [],
        ]]], '2026-10-01');

        $durations = $this->durations(day: [3600, 1800], week: [36000, 7200]);

        $employees = $this->service($durations, ['german', 'anna', 'boris', 'vera'])
            ->paginate([], 'company')
            ->getCollection()
            ->keyBy('id');

        $this->assertSame(5400, $employees['german']->company_seconds_for_day);
        $this->assertSame(43200, $employees['german']->company_seconds_for_week);
        $this->assertSame(5400, $employees['vera']->company_seconds_for_day);
        $this->assertNull($employees['anna']->company_seconds_for_week);
        $this->assertNull($employees['boris']->company_seconds_for_week);
    }

    public function test_company_hours_are_not_calculated_without_company_hourly_rates(): void
    {
        Carbon::setTestNow('2026-10-27 12:00:00');
        $this->rate('anna', ['hourly_rate' => 70000], '2026-10-01');

        $durations = Mockery::mock(PayrollDurationRepository::class);
        $durations->shouldReceive('supervisedSecondsByEmployee')->andReturn(collect());
        $durations->shouldNotReceive('company');

        $employees = $this->service($durations, ['anna'])->paginate([], 'company')->getCollection();

        $this->assertNull($employees->first()->company_seconds_for_day);
    }

    /**
     * Часы компании по проектам: отдельно за текущий день и за текущую неделю.
     *
     * @param  array<int, int>  $day
     * @param  array<int, int>  $week
     */
    private function durations(array $day, array $week): PayrollDurationRepository
    {
        $rows = static fn (array $seconds) => collect($seconds)
            ->map(static fn (int $value, int $index): object => (object) [
                'project_id' => "project-{$index}",
                'duration_seconds' => $value,
            ])
            ->values();
        $durations = Mockery::mock(PayrollDurationRepository::class);
        $durations->shouldReceive('supervisedSecondsByEmployee')->andReturn(collect());
        $durations->shouldReceive('company')
            ->twice()
            ->andReturnUsing(static function (Company $_company, CarbonInterface $from, CarbonInterface $to) use ($rows, $day, $week) {
                // Неделя в часовом поясе компании начинается с понедельника 26.10.
                return $from->diffInDays($to) > 1 ? $rows($week) : $rows($day);
            });

        return $durations;
    }

    /**
     * @param  array<int, string>  $employeeIds
     */
    private function service(PayrollDurationRepository $durations, array $employeeIds): EmployeeService
    {
        $users = collect($employeeIds)->map(static function (string $id): User {
            $user = new User;
            $user->forceFill(['id' => $id, 'company_id' => 'company', 'status' => 'ACTIVE']);

            return $user;
        });
        $employees = Mockery::mock(EmployeeRepository::class);
        $employees->shouldReceive('paginate')->andReturn(new LengthAwarePaginator($users, $users->count(), 20));
        $rates = new EmployeeRateRepository;

        return new EmployeeService(
            $employees,
            $durations,
            $rates,
            new CompanyHourlyPayrollService($rates, Mockery::mock(PayrollHoursService::class)),
        );
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function rate(string $employeeId, array $attributes, string $effectiveFrom): void
    {
        EmployeeRate::query()->create([
            'id' => uniqid('rate-', true),
            'employee_id' => $employeeId,
            'effective_from' => $effectiveFrom,
            ...$attributes,
        ]);
    }
}
