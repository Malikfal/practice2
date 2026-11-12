<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Models\Company;
use App\Models\Finance;
use App\Models\User;
use App\Services\Payroll\Hours\PayrollHoursService;
use App\Services\Workspace\CompanyPayrollSummaryService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class CompanyPayrollSummaryServiceTest extends TestCase
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
        Schema::create('roles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->timestamps();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('role_id')->nullable();
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
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
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company', 'status' => 'ACTIVE', 'timezone' => 'Europe/Moscow']);
        foreach (['anna', 'boris'] as $id) {
            User::query()->create(['id' => $id, 'company_id' => 'company', 'name' => ucfirst($id), 'status' => 'ACTIVE']);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        Schema::dropIfExists('finance');
        Schema::dropIfExists('users');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_default_period_is_current_company_month_up_to_current_week(): void
    {
        // 15.10.2026 в UTC вечером, в Москве уже 16.10 (пятница).
        Carbon::setTestNow('2026-10-15 22:30:00');

        $result = $this->service()->summarize($this->actor(), $this->company(), []);

        $this->assertSame('2026-10-01', $result['requested_from']);
        $this->assertSame('2026-10-31', $result['requested_to']);
        $this->assertSame('2026-10-01', $result['from']);
        $this->assertSame('2026-10-18', $result['to']);
        $this->assertSame('2026-10-16', $result['today']);
        $this->assertSame(
            ['2026-10-12', '2026-10-05', '2026-10-01'],
            $result['periods']->pluck('from')->all(),
        );
    }

    public function test_month_quarter_and_year_totals_equal_sum_of_weeks(): void
    {
        Carbon::setTestNow('2026-10-15 12:00:00');
        // Неделя 28.09-04.10 разрезана границей месяца: 30.09 уходит в сентябрь, 04.10 в октябрь.
        $this->finance('anna', 10000, '2026-09-27');
        $this->finance('anna', 20000, '2026-09-30');
        $this->finance('boris', 5000, '2026-09-30');
        $this->finance('anna', 30000, '2026-10-04');
        $this->finance('boris', 7000, '2026-10-11');
        $hours = [
            '2026-09-21' => ['anna' => [3600, 0]],
            '2026-09-28' => ['anna' => [1800, 600], 'boris' => [0, 7200]],
            '2026-10-01' => ['anna' => [900, 0]],
            '2026-10-05' => ['boris' => [3600, 0]],
        ];

        $weeks = $this->service($hours)->summarize($this->actor(), $this->company(), [
            'from' => '2026-09-21', 'to' => '2026-10-15', 'group_by' => 'week',
        ]);
        $months = $this->service($hours)->summarize($this->actor(), $this->company(), [
            'from' => '2026-09-21', 'to' => '2026-10-15', 'group_by' => 'month',
        ]);
        $quarters = $this->service($hours)->summarize($this->actor(), $this->company(), [
            'from' => '2026-09-21', 'to' => '2026-10-15', 'group_by' => 'quarter',
        ]);
        $years = $this->service($hours)->summarize($this->actor(), $this->company(), [
            'from' => '2026-09-21', 'to' => '2026-10-15', 'group_by' => 'year',
        ]);

        $this->assertSame(
            ['2026-10-12', '2026-10-05', '2026-10-01', '2026-09-28', '2026-09-21'],
            $weeks['groups']->pluck('key')->all(),
        );
        $this->assertSame(['2026-10', '2026-09'], $months['groups']->pluck('key')->all());
        $this->assertSame(['2026-Q4', '2026-Q3'], $quarters['groups']->pluck('key')->all());
        $this->assertSame(['2026'], $years['groups']->pluck('key')->all());

        foreach ([$months, $quarters, $years] as $summary) {
            foreach ($summary['groups'] as $group) {
                $periods = $weeks['periods']->filter(
                    static fn (array $period): bool => $period['from'] >= $group['from'] && $period['to'] <= $group['to'],
                );
                foreach (['own_seconds', 'supervised_seconds', 'amount_kopecks'] as $field) {
                    $this->assertSame($periods->sum($field), $group[$field], "{$group['key']} {$field}");
                }
                $this->assertSame($periods->count(), $group['periods_count']);
            }
            $this->assertSame($weeks['totals'], $summary['totals']);
        }

        $september = $months['groups'][1];
        $this->assertSame('2026-09-21', $september['from']);
        $this->assertSame('2026-09-30', $september['to']);
        $this->assertSame('2026-09-01', $september['calendar_from']);
        $this->assertSame('2026-09-30', $september['calendar_to']);
        $this->assertFalse($september['is_current']);
        $this->assertSame(35000, $september['amount_kopecks']);
        $this->assertSame(
            ['anna' => 30000, 'boris' => 5000],
            collect($september['values'])->pluck('amount_kopecks', 'employee_id')->all(),
        );

        $october = $months['groups'][0];
        $this->assertTrue($october['is_current']);
        $this->assertSame('2026-10-18', $october['to']);
        $this->assertSame(37000, $october['amount_kopecks']);
        $this->assertSame(4500, $october['own_seconds']);

        $this->assertSame(72000, $weeks['totals']['amount_kopecks']);
        $this->assertSame(2, $weeks['totals']['employees_count']);
        $this->assertSame(
            ['anna' => 60000, 'boris' => 12000],
            $weeks['employees']->mapWithKeys(static fn (array $row): array => [(string) $row['employee']->id => $row['amount_kopecks']])->all(),
        );
    }

    public function test_employee_with_hours_but_without_accrual_is_listed(): void
    {
        Carbon::setTestNow('2026-10-15 12:00:00');

        $result = $this->service(['2026-10-12' => ['boris' => [5400, 0]]])
            ->summarize($this->actor(), $this->company(), ['from' => '2026-10-12', 'to' => '2026-10-18']);

        $this->assertSame(1, $result['groups'][0]['employees_count']);
        $this->assertSame(
            [['employee_id' => 'boris', 'own_seconds' => 5400, 'supervised_seconds' => 0, 'amount_kopecks' => 0]],
            $result['groups'][0]['values'],
        );
    }

    public function test_filter_is_extended_to_whole_periods_and_future_weeks_are_dropped(): void
    {
        Carbon::setTestNow('2026-10-15 12:00:00');

        $result = $this->service()->summarize($this->actor(), $this->company(), [
            'from' => '2026-09-30', 'to' => '2026-12-31', 'group_by' => 'month',
        ]);

        // 30.09 входит в период 28.09-30.09, дальше 18.10 периодов ещё нет.
        $this->assertSame('2026-09-28', $result['from']);
        $this->assertSame('2026-10-18', $result['to']);
        $this->assertSame(['2026-10', '2026-09'], $result['groups']->pluck('key')->all());

        $future = $this->service()->summarize($this->actor(), $this->company(), [
            'from' => '2026-11-01', 'to' => '2026-11-30',
        ]);
        $this->assertSame(0, $future['periods']->count());
        $this->assertSame(0, $future['totals']['amount_kopecks']);
    }

    public function test_requires_salary_permission(): void
    {
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 'actor', 'company_id' => 'company', 'status' => 'ACTIVE']);
        $actor->shouldReceive('can')->andReturnFalse();

        $this->expectException(NotFoundHttpException::class);

        $this->service()->summarize($actor, $this->company(), []);
    }

    /**
     * @param  array<string, array<string, array{0:int, 1:int}>>  $hours  начало периода => сотрудник => [свои, под контролем]
     */
    private function service(array $hours = []): CompanyPayrollSummaryService
    {
        $payrollHours = Mockery::mock(PayrollHoursService::class);
        $pick = static fn (int $index) => static function (Company $company, CarbonInterface $from) use ($hours, $index) {
            return collect($hours[$from->toDateString()] ?? [])
                ->map(static fn (array $seconds): int => $seconds[$index])
                ->filter();
        };
        $payrollHours->shouldReceive('ownSecondsByEmployee')->andReturnUsing($pick(0));
        $payrollHours->shouldReceive('supervisedSecondsByEmployee')->andReturnUsing($pick(1));

        return new CompanyPayrollSummaryService($payrollHours);
    }

    private function actor(): User
    {
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 'actor', 'company_id' => 'company', 'status' => 'ACTIVE']);
        $actor->shouldReceive('can')->andReturnTrue();

        return $actor;
    }

    private function company(): Company
    {
        return Company::query()->findOrFail('company');
    }

    private function finance(string $employeeId, int $amount, string $date): void
    {
        Finance::query()->create([
            'id' => uniqid('finance-', true),
            'company_id' => 'company',
            'employee_id' => $employeeId,
            'amount' => $amount,
            'type' => FinanceType::EXPENDITURE,
            'source' => FinanceSource::MANUAL,
            'dateOfPayment' => $date,
        ]);
    }
}
