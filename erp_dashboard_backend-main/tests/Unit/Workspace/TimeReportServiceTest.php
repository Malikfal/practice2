<?php

namespace Tests\Unit\Workspace;

use App\Enums\UserRole;
use App\Models\User;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use App\Services\Workspace\Reports\TimeReportService;
use Illuminate\Support\Collection;
use Mockery;
use Tests\TestCase;

class TimeReportServiceTest extends TestCase
{
    public function test_manager_sees_only_projects_where_they_are_assigned(): void
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $this->mockTimezone($repository);
        $actor = $this->managerAssignedToProjects(['project-1', 'project-2']);

        $repository
            ->shouldReceive('own')
            ->once()
            ->withArgs(fn (
                string $companyId,
                mixed $from,
                mixed $to,
                string $groupBy,
                array $projectIds,
            ): bool => $companyId === 'company-1'
                && $groupBy === 'project'
                && $projectIds === ['project-1', 'project-2'])
            ->andReturn(collect());

        $report = (new TimeReportService($repository))->build(
            $this->payload(),
            'company-1',
            $actor,
        );

        $this->assertSame(['project-1', 'project-2'], $report['project_ids']);
    }

    public function test_manager_requested_project_filter_is_intersected_with_assigned_projects(): void
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $this->mockTimezone($repository);
        $actor = $this->managerAssignedToProjects(['project-1']);

        $repository
            ->shouldReceive('own')
            ->once()
            ->withArgs(fn (
                string $companyId,
                mixed $from,
                mixed $to,
                string $groupBy,
                array $projectIds,
            ): bool => $projectIds === ['project-1'])
            ->andReturn(collect());

        $report = (new TimeReportService($repository))->build(
            $this->payload(['project_ids' => ['project-1', 'project-2']]),
            'company-1',
            $actor,
        );

        $this->assertSame(['project-1'], $report['project_ids']);
    }

    public function test_manager_without_assigned_projects_receives_empty_report(): void
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $this->mockTimezone($repository);
        $repository->shouldNotReceive('own');

        $report = (new TimeReportService($repository))->build(
            $this->payload(),
            'company-1',
            $this->managerAssignedToProjects([]),
        );

        $this->assertSame([], $report['project_ids']);
        $this->assertInstanceOf(Collection::class, $report['rows']);
        $this->assertTrue($report['rows']->isEmpty());
    }

    public function test_project_kinds_and_managers_are_passed_to_repository(): void
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $this->mockTimezone($repository);
        $repository
            ->shouldReceive('own')
            ->once()
            ->withArgs(static fn (...$args): bool => $args[4] === ['project-1']
                && $args[9] === ['internal']
                && $args[10] === ['manager-1', 'manager-2']
                && $args[11] === null)
            ->andReturn(collect());

        $report = (new TimeReportService($repository))->build(
            $this->payload([
                'project_ids' => ['project-1'],
                'project_kinds' => ['internal'],
                'manager_ids' => ['manager-1', 'manager-2'],
            ]),
            'company-1',
        );

        $this->assertSame(['internal'], $report['project_kinds']);
        $this->assertSame(['manager-1', 'manager-2'], $report['manager_ids']);
    }

    public function test_manager_project_kind_filter_stays_within_assigned_projects(): void
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $this->mockTimezone($repository);
        $actor = $this->managerAssignedToProjects(['project-1', 'project-2']);
        $repository
            ->shouldReceive('own')
            ->once()
            ->withArgs(static fn (...$args): bool => $args[4] === []
                && $args[9] === ['commercial']
                && $args[11] === ['project-1', 'project-2'])
            ->andReturn(collect());

        (new TimeReportService($repository))->build(
            $this->payload(['project_kinds' => ['commercial']]),
            'company-1',
            $actor,
        );
    }

    public function test_report_uses_company_timezone_exclusive_end_and_returns_own_hours(): void
    {
        $repository = Mockery::mock(TimeReportRepository::class);
        $this->mockTimezone($repository, 'Asia/Yekaterinburg');
        $repository->shouldReceive('own')
            ->once()
            ->withArgs(static fn (
                string $companyId,
                mixed $from,
                mixed $to,
            ): bool => $companyId === 'company-1'
                && $from->timezoneName === 'Asia/Yekaterinburg'
                && $from->toDateTimeString() === '2026-07-01 00:00:00'
                && $to->toDateTimeString() === '2026-08-01 00:00:00')
            ->andReturn(collect([
                (object) ['project_id' => 'project-1', 'project_name' => 'One', 'duration_seconds' => 3600],
                (object) ['project_id' => 'project-2', 'project_name' => 'Two', 'duration_seconds' => 100],
            ]));

        $report = (new TimeReportService($repository))->build($this->payload(), 'company-1');

        $this->assertSame(3700, $report['own_seconds']);
        $this->assertArrayNotHasKey('supervised_seconds', $report);
        $this->assertArrayNotHasKey('supervised_seconds', $report['rows'][0]);
        $this->assertSame('2026-07-31', $report['to']->toDateString());
    }

    private function managerAssignedToProjects(array $projectIds): User
    {
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->setRawAttributes([
            'id' => 'manager-1',
            'role' => UserRole::MANAGER->value,
        ]);
        $actor
            ->shouldReceive('assignedProjectIds')
            ->once()
            ->andReturn(collect($projectIds));

        return $actor;
    }

    private function payload(array $overrides = []): array
    {
        return [
            'from' => '2026-07-01',
            'to' => '2026-07-31',
            'group_by' => 'project',
            ...$overrides,
        ];
    }

    private function mockTimezone(TimeReportRepository $repository, string $timezone = 'Europe/Moscow'): void
    {
        $repository->shouldReceive('timezoneForCompany')
            ->once()
            ->with('company-1')
            ->andReturn($timezone);
    }
}
