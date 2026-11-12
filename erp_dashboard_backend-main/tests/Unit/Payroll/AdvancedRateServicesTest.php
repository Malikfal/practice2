<?php

namespace Tests\Unit\Payroll;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollProjectHoursType;
use App\Enums\PayrollRangeCalculationMethod;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Calculation\Rates\DailyEmployeeRatePayrollService;
use App\Services\Payroll\Calculation\Rates\PayrollAmount;
use App\Services\Payroll\Calculation\Rates\PayrollRateRange;
use App\Services\Payroll\Calculation\Rates\PayrollRateSetting;
use App\Services\Payroll\Calculation\Rates\Types\HourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\SupervisedHourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\Types\WeeklySalaryPayrollService;
use App\Services\Payroll\Calculation\Rates\WeeklyEmployeeRatePayrollService;
use App\Services\Payroll\Distribution\PayrollProjectDistributionService;
use App\Services\Payroll\Hours\PayrollHoursService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Mockery;
use Tests\TestCase;

class AdvancedRateServicesTest extends TestCase
{
    public function test_hourly_threshold_recalculates_all_hours_by_reached_range(): void
    {
        $service = $this->hourlyService($this->durations(370, false));
        $calculation = $this->weeklyCalculator()->calculate(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($this->setting(EmployeeRateType::HOURLY, PayrollRangeCalculationMethod::THRESHOLD)),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-21'),
        );

        $this->assertSame(1110000, $calculation->amount);
        $this->assertSame(1110000, $calculation->amount);
    }

    public function test_hourly_progressive_counts_each_range_separately(): void
    {
        $service = $this->hourlyService($this->durations(360, false));
        $calculation = $this->weeklyCalculator()->calculate(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($this->setting(EmployeeRateType::HOURLY, PayrollRangeCalculationMethod::PROGRESSIVE)),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-21'),
        );

        $this->assertSame(755000, $calculation->amount);
        $this->assertSame(755000, $calculation->amount);
    }

    public function test_salary_uses_reached_range_as_weekly_amount(): void
    {
        $setting = $this->setting(
            EmployeeRateType::WEEKLY_SALARY,
            PayrollRangeCalculationMethod::THRESHOLD,
            [
                ['from' => 0, 'to' => 25, 'rate' => 0],
                ['from' => 25, 'to' => null, 'rate' => 1000000],
            ],
            defaultRate: 0,
        );
        $service = $this->salaryService($this->durations(26, false));
        $calculation = $this->weeklyCalculator()->calculate(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($setting, salary: 0),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-21'),
        );

        $this->assertSame(1000000, $calculation->amount);
        $this->assertSame(1000000, $calculation->amount);
    }

    public function test_daily_ignores_setting_default_rate_when_advanced_is_disabled(): void
    {
        $durations = $this->durations(10, false);
        $service = $this->hourlyService($durations);
        $setting = $this->setting(
            EmployeeRateType::HOURLY,
            PayrollRangeCalculationMethod::THRESHOLD,
            defaultRate: 9999,
            isAdvanced: false,
        );

        $component = $this->dailyCalculator()->components(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($setting),
            Carbon::parse('2026-06-15'),
        )->sole();

        $this->assertSame(20000, $component->amount);
    }

    public function test_daily_uses_base_rate_when_rate_has_no_settings(): void
    {
        $durations = $this->durations(10, false);
        $service = $this->hourlyService($durations);

        $component = $this->dailyCalculator()->components(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rateWithoutSettings(hourlyRate: 2000),
            Carbon::parse('2026-06-15'),
        )->sole();

        $this->assertSame(20000, $component->amount);
    }

    public function test_weekly_target_uses_base_rate_when_rate_has_no_settings(): void
    {
        $service = $this->hourlyService($this->durations(370, false));

        $calculation = $this->weeklyCalculator()->calculate(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rateWithoutSettings(hourlyRate: 2000),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-21'),
        );

        $this->assertSame(740000, $calculation->amount);
        $this->assertSame(740000, $calculation->amount);
    }

    public function test_period_total_can_be_calculated_by_daily_rate_slices(): void
    {
        $service = $this->hourlyServiceByPeriod($this->durations(20, false), $this->durations(50, false), $this->durations(70, false));
        $oldSetting = $this->setting(
            EmployeeRateType::HOURLY,
            PayrollRangeCalculationMethod::THRESHOLD,
            [
                ['from' => 0, 'to' => null, 'rate' => 3000],
            ],
            defaultRate: 2000,
        );
        $newSetting = $this->setting(
            EmployeeRateType::HOURLY,
            PayrollRangeCalculationMethod::THRESHOLD,
            [
                ['from' => 0, 'to' => null, 'rate' => 5000],
            ],
            defaultRate: 2000,
        );
        $weeklyCalculator = $this->weeklyCalculator();
        $oldCalculation = $weeklyCalculator->calculateForPeriod(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($oldSetting),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-17'),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-22'),
        );
        $newCalculation = $weeklyCalculator->calculateForPeriod(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($newSetting),
            Carbon::parse('2026-06-17'),
            Carbon::parse('2026-06-22'),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-22'),
        );

        $this->assertSame(60000, $oldCalculation->amount);
        $this->assertSame(250000, $newCalculation->amount);
    }

    public function test_weekly_target_is_calculated_without_subtracting_daily_finance(): void
    {
        $service = $this->hourlyService($this->durations(370, false));
        $calculation = $this->weeklyCalculator()->calculate(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($this->setting(EmployeeRateType::HOURLY, PayrollRangeCalculationMethod::THRESHOLD)),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-21'),
        );

        $this->assertSame(1110000, $calculation->amount);
    }

    public function test_supervised_hourly_includes_manager_own_hours(): void
    {
        $durations = $this->durations(10, false);
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('supervised')
            ->once()
            ->with(
                Mockery::type(Company::class),
                Mockery::type(User::class),
                Mockery::type(Carbon::class),
                Mockery::type(Carbon::class),
            )
            ->andReturn($durations);

        $service = new SupervisedHourlyPayrollService($repository, $hours);

        $this->assertSame(
            $durations,
            $service->durations(
                new Company(['id' => 'company']),
                new User(['id' => 'employee']),
                Carbon::parse('2026-06-15'),
                Carbon::parse('2026-06-22'),
                null,
            ),
        );
    }

    /**
     * Проверяет, что разные типы ставок сохраняют собственные проектные основания.
     */
    public function test_daily_rate_types_are_distributed_by_their_own_hours(): void
    {
        $ownDurations = $this->durationsForProject('own-project', 10);
        $supervisedDurations = $this->durationsForProject('managed-project', 20);
        $hourly = $this->hourlyService($ownDurations);

        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('settingForDate')->andReturnNull();
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('supervised')->andReturn($supervisedDurations);
        $supervised = new SupervisedHourlyPayrollService($repository, $hours);
        $rate = new EmployeeRate([
            'hourly_rate' => 1000,
            'supervised_hourly_rate' => 1000,
            'effective_from' => '2026-06-01',
        ]);
        $calculator = $this->dailyCalculator();
        $company = new Company(['id' => 'company']);
        $employee = new User(['id' => 'employee']);
        $day = Carbon::parse('2026-06-15');

        $ownComponent = $calculator->components($hourly, $company, $employee, $rate, $day)->sole();
        $supervisedComponent = $calculator->components($supervised, $company, $employee, $rate, $day)->sole();
        $distribution = new PayrollProjectDistributionService;
        $ownRows = $distribution->distribute($ownComponent->amount, $ownComponent->durations);
        $supervisedRows = $distribution->distribute($supervisedComponent->amount, $supervisedComponent->durations);

        $this->assertSame(['own-project'], $ownRows->pluck('projectId')->all());
        $this->assertSame(['managed-project'], $supervisedRows->pluck('projectId')->all());
    }

    public function test_weekly_salary_daily_split_preserves_week_total(): void
    {
        $weekStart = Carbon::parse('2026-06-22');
        $amount = collect(range(0, 6))
            ->sum(static fn (int $offset): int => PayrollAmount::weeklySalaryForDay(1000000, $weekStart->copy()->addDays($offset)));

        $this->assertSame(1000000, $amount);
    }

    public function test_hourly_amount_is_calculated_from_seconds_with_integer_rounding(): void
    {
        $this->assertSame(4391667, PayrollAmount::fromSeconds(158100, 100000));
        $this->assertSame(333, PayrollAmount::fromSeconds(20, 60000));
    }

    private function hourlyService(Collection $durations): HourlyPayrollService
    {
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('settingForDate')->andReturnUsing(
            static fn (EmployeeRate $rate) => self::settingFromRate($rate),
        );
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('own')->andReturn($durations);

        return new HourlyPayrollService($repository, $hours);
    }

    private function hourlyServiceByPeriod(
        Collection $oldPeriodDurations,
        Collection $newPeriodDurations,
        Collection $weekDurations,
    ): HourlyPayrollService {
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('settingForDate')->andReturnUsing(
            static fn (EmployeeRate $rate) => self::settingFromRate($rate),
        );
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('own')->andReturnUsing(
            static function (Company $company, User $employee, Carbon $from, Carbon $to) use ($oldPeriodDurations, $newPeriodDurations, $weekDurations): Collection {
                if ($from->toDateString() === '2026-06-15' && $to->toDateString() === '2026-06-17') {
                    return $oldPeriodDurations;
                }

                if ($from->toDateString() === '2026-06-17' && $to->toDateString() === '2026-06-22') {
                    return $newPeriodDurations;
                }

                return $weekDurations;
            },
        );

        return new HourlyPayrollService($repository, $hours);
    }

    private function salaryService(Collection $durations): WeeklySalaryPayrollService
    {
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('settingForDate')->andReturnUsing(
            static fn (EmployeeRate $rate) => self::settingFromRate($rate),
        );
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('company')->andReturn($durations);

        return new WeeklySalaryPayrollService($repository, $hours);
    }

    private function dailyCalculator(): DailyEmployeeRatePayrollService
    {
        return new DailyEmployeeRatePayrollService;
    }

    private function weeklyCalculator(): WeeklyEmployeeRatePayrollService
    {
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('secondsByProjectType')->andReturnUsing(static function (Collection $durations): Collection {
            return collect([
                PayrollProjectHoursType::COMMERCIAL->value => (int) $durations->where('is_internal', false)->sum('duration_seconds'),
                PayrollProjectHoursType::INTERNAL->value => (int) $durations->where('is_internal', true)->sum('duration_seconds'),
            ]);
        });

        return new WeeklyEmployeeRatePayrollService($hours);
    }

    private function rate(PayrollRateSetting $setting, int $salary = 0): EmployeeRate
    {
        return new EmployeeRate([
            'salary' => $salary,
            'hourly_rate' => 2000,
            'rate_settings' => [
                $setting->rateType->value => $setting->toArray(),
            ],
            'effective_from' => '2026-06-01',
        ]);
    }

    private function rateWithoutSettings(int $hourlyRate = 0, int $salary = 0): EmployeeRate
    {
        return new EmployeeRate([
            'salary' => $salary,
            'hourly_rate' => $hourlyRate,
            'rate_settings' => null,
            'effective_from' => '2026-06-01',
        ]);
    }

    private static function settingFromRate(EmployeeRate $rate): ?PayrollRateSetting
    {
        $setting = collect($rate->rate_settings)->first();

        return is_array($setting) ? PayrollRateSetting::fromArray($setting) : null;
    }

    private function setting(
        EmployeeRateType $type,
        PayrollRangeCalculationMethod $method,
        ?array $ranges = null,
        int $defaultRate = 2000,
        bool $isAdvanced = true,
    ): PayrollRateSetting {
        $ranges ??= [
            ['from' => 0, 'to' => 300, 'rate' => 2000],
            ['from' => 300, 'to' => 350, 'rate' => 2500],
            ['from' => 350, 'to' => 400, 'rate' => 3000],
        ];

        return new PayrollRateSetting(
            $type,
            $isAdvanced,
            $defaultRate,
            false,
            null,
            $method,
            null,
            collect($ranges)->map(
                static fn (array $range, int $position): PayrollRateRange => new PayrollRateRange(
                    PayrollProjectHoursType::ALL,
                    (float) $range['from'],
                    $range['to'] !== null ? (float) $range['to'] : null,
                    (int) $range['rate'],
                    $position,
                ),
            ),
        );
    }

    private function durations(int $hours, bool $isInternal): Collection
    {
        return collect([
            (object) [
                'project_id' => 'project',
                'project_name' => 'Project',
                'is_internal' => $isInternal,
                'duration_seconds' => $hours * 3600,
            ],
        ]);
    }

    /** @return Collection<int, object> */
    private function durationsForProject(string $projectId, int $hours): Collection
    {
        return collect([
            (object) [
                'project_id' => $projectId,
                'project_name' => $projectId,
                'is_internal' => false,
                'duration_seconds' => $hours * 3600,
            ],
        ]);
    }
}
