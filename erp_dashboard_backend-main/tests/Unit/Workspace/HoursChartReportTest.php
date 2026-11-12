<?php

namespace Tests\Unit\Workspace;

use App\Enums\UserRole;
use App\Http\Requests\Workspace\HoursChartReportRequest;
use App\Models\User;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use App\Services\Workspace\Reports\HoursChartReportService;
use App\Services\Workspace\Reports\TimeReportService;
use Illuminate\Support\Facades\Validator;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class HoursChartReportTest extends TestCase
{
    private const HOUR = 3600;

    public function test_days_include_empty_dates_and_total(): void
    {
        $report = $this->report(
            ['from' => '2026-10-01', 'to' => '2026-10-03'],
            [['2026-10-01', 2 * self::HOUR], ['2026-10-03', self::HOUR]],
        );

        $this->assertSame([
            ['key' => '2026-10-01', 'from' => '2026-10-01', 'to' => '2026-10-01', 'partial' => false, 'seconds' => 2 * self::HOUR],
            ['key' => '2026-10-02', 'from' => '2026-10-02', 'to' => '2026-10-02', 'partial' => false, 'seconds' => 0],
            ['key' => '2026-10-03', 'from' => '2026-10-03', 'to' => '2026-10-03', 'partial' => false, 'seconds' => self::HOUR],
        ], $report['rows']);
        $this->assertSame(3 * self::HOUR, $report['total_seconds']);
        $this->assertSame('2026-10-01', $report['from']);
        $this->assertSame('2026-10-03', $report['to']);
    }

    public function test_weeks_start_on_monday_and_edges_are_clipped(): void
    {
        // 1 октября 2026 — четверг, 12 октября — понедельник.
        $report = $this->report(
            ['from' => '2026-10-01', 'to' => '2026-10-12', 'group_by' => 'week'],
            [['2026-10-04', self::HOUR], ['2026-10-05', 2 * self::HOUR], ['2026-10-11', 3 * self::HOUR], ['2026-10-12', 4 * self::HOUR]],
        );

        $this->assertSame([
            ['key' => '2026-09-28', 'from' => '2026-10-01', 'to' => '2026-10-04', 'partial' => true, 'seconds' => self::HOUR],
            ['key' => '2026-10-05', 'from' => '2026-10-05', 'to' => '2026-10-11', 'partial' => false, 'seconds' => 5 * self::HOUR],
            ['key' => '2026-10-12', 'from' => '2026-10-12', 'to' => '2026-10-12', 'partial' => true, 'seconds' => 4 * self::HOUR],
        ], $report['rows']);
    }

    public function test_months_sum_days_and_mark_incomplete_month(): void
    {
        $report = $this->report(
            ['from' => '2026-09-01', 'to' => '2026-10-15', 'group_by' => 'month'],
            [['2026-09-01', self::HOUR], ['2026-09-30', self::HOUR], ['2026-10-15', self::HOUR]],
        );

        $this->assertSame([
            ['key' => '2026-09-01', 'from' => '2026-09-01', 'to' => '2026-09-30', 'partial' => false, 'seconds' => 2 * self::HOUR],
            ['key' => '2026-10-01', 'from' => '2026-10-01', 'to' => '2026-10-15', 'partial' => true, 'seconds' => self::HOUR],
        ], $report['rows']);
    }

    public function test_filters_are_passed_to_time_report_query(): void
    {
        $repository = $this->repository('Asia/Yekaterinburg');
        $repository->shouldReceive('own')
            ->once()
            ->withArgs(static fn (...$args): bool => $args[0] === 'company-1'
                && $args[1]->timezoneName === 'Asia/Yekaterinburg'
                && $args[1]->toDateTimeString() === '2026-10-01 00:00:00'
                && $args[2]->toDateTimeString() === '2026-11-01 00:00:00'
                && $args[3] === 'day'
                && $args[4] === ['project-1']
                && $args[6] === ['user-1']
                && $args[8] === 'Asia/Yekaterinburg'
                && $args[9] === ['internal']
                && $args[10] === ['manager-1']
                && $args[12] === ['client-1'])
            ->andReturn(collect());

        $report = $this->service($repository)->build([
            'from' => '2026-10-01',
            'to' => '2026-10-31',
            'project_ids' => ['project-1'],
            'project_kinds' => ['internal'],
            'user_ids' => ['user-1'],
            'manager_ids' => ['manager-1'],
            'client_ids' => ['client-1', ' ', 'client-1'],
        ], 'company-1');

        $this->assertSame('day', $report['group_by']);
        $this->assertSame(['client-1'], $report['client_ids']);
        $this->assertCount(31, $report['rows']);
        $this->assertSame(0, $report['total_seconds']);
    }

    public function test_manager_without_assigned_projects_gets_zero_series(): void
    {
        $repository = $this->repository();
        $repository->shouldNotReceive('own');
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->setRawAttributes(['id' => 'manager-1', 'role' => UserRole::MANAGER->value]);
        $actor->shouldReceive('assignedProjectIds')->once()->andReturn(collect());

        $report = $this->service($repository)->build(['from' => '2026-10-01', 'to' => '2026-10-02'], 'company-1', $actor);

        $this->assertSame([0, 0], array_column($report['rows'], 'seconds'));
    }

    public function test_request_accepts_only_chart_groupings(): void
    {
        $rules = ['group_by' => (new HoursChartReportRequest)->rules()['group_by']];

        foreach (HoursChartReportService::GROUPS as $group) {
            $this->assertTrue(Validator::make(['group_by' => $group], $rules)->passes());
        }
        $this->assertTrue(Validator::make([], $rules)->passes(), 'По умолчанию — по дням.');
        $this->assertFalse(Validator::make(['group_by' => 'project'], $rules)->passes());
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<array{0: string, 1: int}>  $days
     * @return array<string, mixed>
     */
    private function report(array $payload, array $days): array
    {
        $repository = $this->repository();
        $repository->shouldReceive('own')->once()->andReturn(collect(array_map(
            static fn (array $day): object => (object) ['date' => $day[0], 'duration_seconds' => $day[1]],
            $days,
        )));

        return $this->service($repository)->build($payload, 'company-1');
    }

    private function repository(string $timezone = 'Europe/Moscow'): MockInterface&TimeReportRepository
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $repository->shouldReceive('timezoneForCompany')->once()->with('company-1')->andReturn($timezone);

        return $repository;
    }

    private function service(TimeReportRepository $repository): HoursChartReportService
    {
        return new HoursChartReportService(new TimeReportService($repository), $repository);
    }
}
