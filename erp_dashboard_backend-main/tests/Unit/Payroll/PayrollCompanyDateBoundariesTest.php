<?php

namespace Tests\Unit\Payroll;

use App\Models\User;
use App\Repositories\Workspace\EmployeeAbsenceRepository;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Absence\EmployeeAbsencePayrollService;
use App\Services\Payroll\Calculation\Data\EmployeeRatePeriod;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Даты ставок и отсутствий — календарные дни компании. Приложение работает в UTC,
 * а период расчёта строится в часовом поясе компании, поэтому границы не должны
 * сдвигаться на разницу между поясами.
 */
class PayrollCompanyDateBoundariesTest extends TestCase
{
    private const TIMEZONE = 'Europe/Moscow';

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->date('effective_from');
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('employee_absences', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('employee_id');
            $table->date('date_from');
            $table->date('date_to');
            $table->string('payment_mode');
            $table->unsignedBigInteger('fixed_daily_amount')->nullable();
            $table->decimal('coefficient', 8, 4)->nullable();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('employee_absences');
        Schema::dropIfExists('employee_rates');

        parent::tearDown();
    }

    public function test_rate_change_splits_period_at_company_midnight(): void
    {
        DB::table('employee_rates')->insert([
            ['id' => 'old-rate', 'employee_id' => 'employee', 'effective_from' => '2026-06-16', 'created_at' => '2026-06-16 10:00:00'],
            ['id' => 'new-rate', 'employee_id' => 'employee', 'effective_from' => '2026-09-28', 'created_at' => '2026-09-25 10:00:00'],
        ]);

        $periods = app(EmployeeRateRepository::class)->ratePeriodsForPeriod(
            $this->employee(),
            $this->companyDate('2026-09-21'),
            $this->companyDate('2026-10-01'),
        );

        $this->assertSame([
            ['rate' => 'old-rate', 'from' => '2026-09-21 00:00:00', 'to' => '2026-09-28 00:00:00'],
            ['rate' => 'new-rate', 'from' => '2026-09-28 00:00:00', 'to' => '2026-10-01 00:00:00'],
        ], $periods->map(fn (EmployeeRatePeriod $period): array => [
            'rate' => $period->rate->id,
            'from' => $this->companyDateTime($period->from),
            'to' => $this->companyDateTime($period->to),
        ])->all());
    }

    public function test_rate_starting_on_first_day_of_period_does_not_leave_slice_for_previous_rate(): void
    {
        DB::table('employee_rates')->insert([
            ['id' => 'old-rate', 'employee_id' => 'employee', 'effective_from' => '2026-06-16', 'created_at' => '2026-06-16 10:00:00'],
            ['id' => 'new-rate', 'employee_id' => 'employee', 'effective_from' => '2026-09-28', 'created_at' => '2026-09-25 10:00:00'],
        ]);

        $periods = app(EmployeeRateRepository::class)->ratePeriodsForPeriod(
            $this->employee(),
            $this->companyDate('2026-09-28'),
            $this->companyDate('2026-10-01'),
        );

        $this->assertSame([
            ['rate' => 'new-rate', 'from' => '2026-09-28 00:00:00', 'to' => '2026-10-01 00:00:00'],
        ], $periods->map(fn (EmployeeRatePeriod $period): array => [
            'rate' => $period->rate->id,
            'from' => $this->companyDateTime($period->from),
            'to' => $this->companyDateTime($period->to),
        ])->all());
    }

    public function test_fixed_absence_covers_last_day_of_period_when_it_continues_after_period(): void
    {
        $this->insertFixedAbsence('2026-09-28', '2026-10-05');

        $service = new EmployeeAbsencePayrollService(app(EmployeeAbsenceRepository::class));
        $from = $this->companyDate('2026-09-28');
        $to = $this->companyDate('2026-10-01');

        $this->assertSame(
            ['2026-09-28', '2026-09-29', '2026-09-30'],
            $service->fixedComponentsForPeriod($this->employee(), $from, $to)
                ->map(fn ($component): string => $this->companyDateTime($component->periodFrom, 'Y-m-d'))
                ->all(),
        );
        $this->assertTrue($service->payrollPeriodsExcludingFixedAbsences($this->employee(), $from, $to)->isEmpty());
    }

    public function test_fixed_absence_inside_period_splits_it_at_company_midnight(): void
    {
        $this->insertFixedAbsence('2026-09-29', '2026-09-29');

        $service = new EmployeeAbsencePayrollService(app(EmployeeAbsenceRepository::class));
        $from = $this->companyDate('2026-09-28');
        $to = $this->companyDate('2026-10-01');

        $component = $service->fixedComponentsForPeriod($this->employee(), $from, $to)->sole();
        $this->assertSame('2026-09-29 00:00:00', $this->companyDateTime($component->periodFrom));
        $this->assertSame('2026-09-30 00:00:00', $this->companyDateTime($component->periodTo));

        $this->assertSame([
            ['from' => '2026-09-28 00:00:00', 'to' => '2026-09-29 00:00:00'],
            ['from' => '2026-09-30 00:00:00', 'to' => '2026-10-01 00:00:00'],
        ], $service->payrollPeriodsExcludingFixedAbsences($this->employee(), $from, $to)
            ->map(fn (PayrollPeriod $period): array => [
                'from' => $this->companyDateTime($period->from),
                'to' => $this->companyDateTime($period->to),
            ])
            ->all());
    }

    private function insertFixedAbsence(string $from, string $to): void
    {
        DB::table('employee_absences')->insert([
            'id' => 'absence',
            'employee_id' => 'employee',
            'date_from' => $from,
            'date_to' => $to,
            'payment_mode' => 'FIXED',
            'fixed_daily_amount' => 100000,
            'coefficient' => 1,
        ]);
    }

    private function employee(): User
    {
        $employee = new User;
        $employee->id = 'employee';

        return $employee;
    }

    private function companyDate(string $date): Carbon
    {
        return Carbon::parse($date, self::TIMEZONE)->startOfDay();
    }

    /** Переводит момент в часовой пояс компании, чтобы сравнивать именно его, а не текст в исходном поясе. */
    private function companyDateTime(CarbonInterface $date, string $format = 'Y-m-d H:i:s'): string
    {
        return Carbon::instance($date)->setTimezone(self::TIMEZONE)->format($format);
    }
}
