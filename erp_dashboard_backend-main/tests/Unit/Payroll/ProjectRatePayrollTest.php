<?php

namespace Tests\Unit\Payroll;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollProjectHoursType;
use App\Enums\PayrollRangeCalculationMethod;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Repositories\Workspace\PayrollRepositories\PayrollDurationRepository;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Calculation\Rates\DailyEmployeeRatePayrollService;
use App\Services\Payroll\Calculation\Rates\Data\PayrollRateCalculationResult;
use App\Services\Payroll\Calculation\Rates\PayrollProjectRate;
use App\Services\Payroll\Calculation\Rates\PayrollRateRange;
use App\Services\Payroll\Calculation\Rates\PayrollRateSetting;
use App\Services\Payroll\Calculation\Rates\Types\HourlyPayrollService;
use App\Services\Payroll\Calculation\Rates\WeeklyEmployeeRatePayrollService;
use App\Services\Payroll\Hours\PayrollHoursService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Mockery;
use Tests\TestCase;

class ProjectRatePayrollTest extends TestCase
{
    /**
     * Пример из задачи: 70 ч обычных + 50 ч проекта X = 120 ч, обычные часы идут по второму диапазону.
     */
    public function test_project_hours_count_in_ranges_but_are_paid_by_project_rate(): void
    {
        $durations = collect([
            $this->duration('project-a', 70),
            $this->duration('project-x', 50),
        ]);
        $setting = $this->setting(
            PayrollRangeCalculationMethod::THRESHOLD,
            [[0, 100, 69000], [100, null, 80000]],
            ['project-x' => 100000],
            defaultRate: 69000,
        );

        $calculation = $this->calculateWeek($this->hourlyService(static fn (): Collection => $durations), $setting);

        $this->assertSame(70 * 80000, $calculation->amount);
        $this->assertSame(['project-a'], $calculation->durations->pluck('project_id')->all());
        $this->assertCount(1, $calculation->projectAmounts);
        $this->assertSame('project-x', $calculation->projectAmounts->first()->projectId);
        $this->assertSame(50 * 100000, $calculation->projectAmounts->first()->amount);
    }

    public function test_progressive_ranges_are_filled_by_day_order(): void
    {
        $setting = $this->setting(
            PayrollRangeCalculationMethod::PROGRESSIVE,
            [[0, 20, 69000], [20, null, 80000]],
            ['project-x' => 100000],
            defaultRate: 69000,
        );

        // Пн: 10 ч проекта X (0-10), Вт: 8 ч обычных (10-18), Ср: 8 ч обычных (18-26, из них 6 ч во втором диапазоне).
        $projectFirst = $this->calculateWeek($this->hourlyServiceByDays([
            '2026-06-15' => [$this->duration('project-x', 10)],
            '2026-06-16' => [$this->duration('project-a', 8)],
            '2026-06-17' => [$this->duration('project-a', 8)],
        ]), $setting);
        // Пн и Вт: 16 ч обычных в первом диапазоне, Ср: 10 ч проекта X.
        $projectLast = $this->calculateWeek($this->hourlyServiceByDays([
            '2026-06-15' => [$this->duration('project-a', 8)],
            '2026-06-16' => [$this->duration('project-a', 8)],
            '2026-06-17' => [$this->duration('project-x', 10)],
        ]), $setting);

        $this->assertSame(10 * 69000 + 6 * 80000, $projectFirst->amount);
        $this->assertSame(16 * 69000, $projectLast->amount);
        $this->assertSame(10 * 100000, $projectFirst->projectAmounts->sole()->amount);
        $this->assertSame(10 * 100000, $projectLast->projectAmounts->sole()->amount);
    }

    public function test_progressive_range_inside_one_day_is_shared_by_hours_share(): void
    {
        $setting = $this->setting(
            PayrollRangeCalculationMethod::PROGRESSIVE,
            [[0, 10, 69000], [10, null, 80000]],
            ['project-x' => 100000],
            defaultRate: 69000,
        );

        // За день 20 ч: половина обычных, поэтому им достается половина каждого диапазона.
        $calculation = $this->calculateWeek($this->hourlyServiceByDays([
            '2026-06-15' => [$this->duration('project-a', 10), $this->duration('project-x', 10)],
        ]), $setting);

        $this->assertSame(5 * 69000 + 5 * 80000, $calculation->amount);
    }

    public function test_project_hours_count_in_ranges_of_own_project_type(): void
    {
        $durations = collect([
            $this->duration('commercial', 8),
            $this->duration('internal', 6, isInternal: true),
            $this->duration('project-x', 6, isInternal: true),
        ]);
        $setting = $this->setting(
            PayrollRangeCalculationMethod::THRESHOLD,
            [
                [0, 10, 1000, PayrollProjectHoursType::COMMERCIAL],
                [10, null, 2000, PayrollProjectHoursType::COMMERCIAL],
                [0, 10, 1000, PayrollProjectHoursType::INTERNAL],
                [10, null, 3000, PayrollProjectHoursType::INTERNAL],
            ],
            ['project-x' => 5000],
            defaultRate: 1000,
            splitByProjectType: true,
        );

        $calculation = $this->calculateWeek($this->hourlyService(static fn (): Collection => $durations), $setting);

        // Внутренних часов 12 вместе с проектом X, поэтому обычные внутренние идут по 3000.
        $this->assertSame(8 * 1000 + 6 * 3000, $calculation->amount);
        $this->assertSame(6 * 5000, $calculation->projectAmounts->sole()->amount);
    }

    public function test_simple_rate_pays_project_hours_by_project_rate(): void
    {
        $durations = collect([
            $this->duration('project-a', 10),
            $this->duration('project-x', 5),
        ]);
        $setting = $this->setting(
            PayrollRangeCalculationMethod::THRESHOLD,
            [],
            ['project-x' => 5000],
            defaultRate: null,
            isAdvanced: false,
        );

        $calculation = $this->calculateWeek($this->hourlyService(static fn (): Collection => $durations), $setting);

        $this->assertSame(10 * 2000, $calculation->amount);
        $this->assertSame(5 * 5000, $calculation->projectAmounts->sole()->amount);
    }

    public function test_daily_accrual_creates_separate_component_for_project_rate(): void
    {
        $durations = collect([
            $this->duration('project-a', 4),
            $this->duration('project-x', 3),
        ]);
        $setting = $this->setting(
            PayrollRangeCalculationMethod::THRESHOLD,
            [[0, null, 3000]],
            ['project-x' => 5000],
            defaultRate: 2500,
        );

        $components = (new DailyEmployeeRatePayrollService)->components(
            $this->hourlyService(static fn (): Collection => $durations),
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($setting),
            Carbon::parse('2026-06-15'),
        );

        $this->assertSame([4 * 2500, 3 * 5000], $components->pluck('amount')->all());
        $this->assertSame(
            [['project-a'], ['project-x']],
            $components
                ->map(static fn (CalculatedPayrollComponent $component): array => $component->durations->pluck('project_id')->all())
                ->all(),
        );
    }

    public function test_daily_accrual_pays_project_rate_without_base_rate(): void
    {
        $durations = collect([
            $this->duration('project-a', 4),
            $this->duration('project-x', 3),
        ]);
        $setting = $this->setting(
            PayrollRangeCalculationMethod::THRESHOLD,
            [],
            ['project-x' => 5000],
            defaultRate: null,
            isAdvanced: false,
        );

        $components = (new DailyEmployeeRatePayrollService)->components(
            $this->hourlyService(static fn (): Collection => $durations),
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($setting, hourlyRate: 0),
            Carbon::parse('2026-06-15'),
        );

        $this->assertSame(3 * 5000, $components->sole()->amount);
    }

    public function test_project_rates_survive_json_round_trip_and_are_ignored_for_salary(): void
    {
        $setting = PayrollRateSetting::fromArray([
            'rate_type' => EmployeeRateType::HOURLY->value,
            'project_rates' => [['project_id' => 'project-x', 'rate' => 100000]],
        ]);
        $salary = PayrollRateSetting::fromArray([
            'rate_type' => EmployeeRateType::WEEKLY_SALARY->value,
            'project_rates' => [['project_id' => 'project-x', 'rate' => 100000]],
        ]);

        $this->assertSame([['project_id' => 'project-x', 'rate' => 100000]], $setting->toArray()['project_rates']);
        $this->assertSame(100000, $setting->projectRatesById()->get('project-x')->rate);
        $this->assertTrue($salary->projectRatesById()->isEmpty());
    }

    /**
     * Разбивка в деталях расчета должна давать ту же сумму, что и перерасчет.
     */
    public function test_regular_lines_match_weekly_amount_in_every_mode(): void
    {
        $days = [
            '2026-06-15' => [$this->duration('project-a', 8), $this->duration('project-x', 2)],
            '2026-06-16' => [$this->duration('project-a', 8), $this->duration('internal', 3, isInternal: true)],
            '2026-06-17' => [$this->duration('project-a', 6), $this->duration('project-x', 4)],
        ];
        $ranges = [[0, 20, 69000], [20, null, 80000]];
        $splitRanges = [
            [0, 15, 69000, PayrollProjectHoursType::COMMERCIAL],
            [15, null, 80000, PayrollProjectHoursType::COMMERCIAL],
            [0, 2, 50000, PayrollProjectHoursType::INTERNAL],
            [2, null, 60000, PayrollProjectHoursType::INTERNAL],
        ];
        $settings = [
            'простая' => $this->setting(PayrollRangeCalculationMethod::THRESHOLD, [], ['project-x' => 100000], defaultRate: null, isAdvanced: false),
            'достигнутый' => $this->setting(PayrollRangeCalculationMethod::THRESHOLD, $ranges, ['project-x' => 100000], defaultRate: 69000),
            'ступени по дням' => $this->setting(PayrollRangeCalculationMethod::PROGRESSIVE, $ranges, ['project-x' => 100000], defaultRate: 69000),
            'ступени без проектов' => $this->setting(PayrollRangeCalculationMethod::PROGRESSIVE, $ranges, [], defaultRate: 69000),
            'деление по типам' => $this->setting(PayrollRangeCalculationMethod::PROGRESSIVE, $splitRanges, ['project-x' => 100000], defaultRate: 50000, splitByProjectType: true),
        ];
        $service = $this->hourlyServiceByDays($days);
        $weekDurations = $service->durations(
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-22'),
            null,
        );
        $dayDurations = collect($days)
            ->map(fn (array $durations): object => (object) ['in_period' => true, 'durations' => collect($durations)])
            ->values();
        $weekly = new WeeklyEmployeeRatePayrollService(new PayrollHoursService(Mockery::mock(PayrollDurationRepository::class)));

        foreach ($settings as $name => $setting) {
            $calculation = $this->calculateWeek($service, $setting);
            $lines = $weekly->regularLines(
                EmployeeRateType::HOURLY,
                $setting,
                $setting->isAdvanced ? (int) $setting->defaultRate : 2000,
                $weekDurations,
                static fn (): Collection => $dayDurations,
            );

            $this->assertSame($calculation->amount, (int) $lines->sum('amount'), $name);
            $this->assertNotEmpty($lines, $name);
        }
    }

    private function calculateWeek(HourlyPayrollService $service, PayrollRateSetting $setting): PayrollRateCalculationResult
    {
        $hours = new PayrollHoursService(Mockery::mock(PayrollDurationRepository::class));

        return (new WeeklyEmployeeRatePayrollService($hours))->calculate(
            $service,
            new Company(['id' => 'company']),
            new User(['id' => 'employee']),
            $this->rate($setting),
            Carbon::parse('2026-06-15'),
            Carbon::parse('2026-06-21'),
        );
    }

    /** @param callable(Carbon, Carbon): Collection<int, object> $durations */
    private function hourlyService(callable $durations): HourlyPayrollService
    {
        $repository = Mockery::mock(EmployeeRateRepository::class);
        $repository->shouldReceive('settingForDate')->andReturnUsing(
            static fn (EmployeeRate $rate): ?PayrollRateSetting => PayrollRateSetting::fromArray(
                collect($rate->rate_settings)->first(),
            ),
        );
        $hours = Mockery::mock(PayrollHoursService::class);
        $hours->shouldReceive('own')->andReturnUsing(
            static fn (Company $_company, User $_employee, Carbon $from, Carbon $to): Collection => $durations($from, $to),
        );

        return new HourlyPayrollService($repository, $hours);
    }

    /**
     * Возвращает сервис, который отдает часы по дням и их сумму за любой интервал.
     *
     * @param  array<string, list<object>>  $days
     */
    private function hourlyServiceByDays(array $days): HourlyPayrollService
    {
        return $this->hourlyService(static function (Carbon $from, Carbon $to) use ($days): Collection {
            return collect($days)
                ->filter(static fn (array $_durations, string $day): bool => Carbon::parse($day)->gte($from) && Carbon::parse($day)->lt($to))
                ->flatten(1)
                ->groupBy('project_id')
                ->map(static function (Collection $durations): object {
                    $duration = clone $durations->first();
                    $duration->duration_seconds = (int) $durations->sum('duration_seconds');

                    return $duration;
                })
                ->values();
        });
    }

    private function rate(PayrollRateSetting $setting, int $hourlyRate = 2000): EmployeeRate
    {
        return new EmployeeRate([
            'hourly_rate' => $hourlyRate,
            'rate_settings' => [$setting->rateType->value => $setting->toArray()],
            'effective_from' => '2026-06-01',
        ]);
    }

    /**
     * @param  list<array{0:int, 1:?int, 2:int, 3?:PayrollProjectHoursType}>  $ranges
     * @param  array<string, int>  $projectRates
     */
    private function setting(
        PayrollRangeCalculationMethod $method,
        array $ranges,
        array $projectRates,
        ?int $defaultRate,
        bool $isAdvanced = true,
        bool $splitByProjectType = false,
    ): PayrollRateSetting {
        return new PayrollRateSetting(
            EmployeeRateType::HOURLY,
            $isAdvanced,
            $defaultRate,
            $splitByProjectType,
            null,
            $method,
            null,
            collect($ranges)->map(static fn (array $range, int $position): PayrollRateRange => new PayrollRateRange(
                $range[3] ?? PayrollProjectHoursType::ALL,
                (float) $range[0],
                $range[1] !== null ? (float) $range[1] : null,
                $range[2],
                $position,
            )),
            collect($projectRates)
                ->map(static fn (int $rate, string $projectId): PayrollProjectRate => new PayrollProjectRate($projectId, $rate))
                ->values(),
        );
    }

    private function duration(string $projectId, int $hours, bool $isInternal = false): object
    {
        return (object) [
            'project_id' => $projectId,
            'project_name' => $projectId,
            'is_internal' => $isInternal,
            'duration_seconds' => $hours * 3600,
        ];
    }
}
