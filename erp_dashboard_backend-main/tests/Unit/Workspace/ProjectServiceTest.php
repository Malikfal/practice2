<?php

namespace Tests\Unit\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\ProjectRate;
use App\Models\Task;
use App\Repositories\Workspace\ProjectRepository;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use App\Repositories\Workspace\TaskRepository;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use App\Services\Workspace\ProjectActivityHistoryService;
use App\Services\Workspace\ProjectService;
use App\Services\Workspace\ProjectTaskStatusColumnService;
use App\Services\Workspace\TaskActivityService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class ProjectServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Неделя и день считаются в часовом поясе компании; без записи берётся пояс по умолчанию.
        Schema::create('companies', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('timezone')->nullable();
        });
        Schema::create('project_rates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('project_id');
            $table->unsignedBigInteger('rate')->nullable();
            $table->unsignedBigInteger('vat')->nullable();
            $table->string('currency', 3)->default('RUB');
            $table->date('effective_from');
            $table->uuid('changed_by')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        CarbonImmutable::setTestNow();
        Schema::dropIfExists('project_rates');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    public function test_details_adds_weekly_daily_total_seconds_and_rate_to_project(): void
    {
        Carbon::setTestNow('2026-09-16 12:00:00');
        CarbonImmutable::setTestNow('2026-09-16 12:00:00');
        $project = new Project([
            'id' => 'project-id',
            'company_id' => 'company-id',
        ]);
        ProjectRate::query()->create([
            'id' => 'old-rate',
            'project_id' => 'project-id',
            'rate' => 100000,
            'effective_from' => '2026-08-01',
        ]);
        ProjectRate::query()->create([
            'id' => 'current-rate',
            'project_id' => 'project-id',
            'rate' => 150000,
            'effective_from' => '2026-09-01',
        ]);
        ProjectRate::query()->create([
            'id' => 'future-rate',
            'project_id' => 'project-id',
            'rate' => 200000,
            'effective_from' => '2026-10-01',
        ]);

        $projects = Mockery::mock(ProjectRepository::class);
        $projects->shouldReceive('loadWithMembers')->once()->with($project)->andReturn($project);
        $projects->shouldReceive('totalSeconds')->once()->with($project)->andReturn(7200);
        $projects->shouldReceive('durationByEmployee')->once()->with($project)->andReturn(collect());

        $reports = Mockery::mock(TimeReportRepository::class);
        // Сначала текущая неделя, затем текущий день.
        $reports->shouldReceive('own')
            ->twice()
            ->with(
                'company-id',
                Mockery::type(CarbonInterface::class),
                Mockery::type(CarbonInterface::class),
                'project',
                ['project-id'],
            )
            ->andReturn(
                collect([(object) ['duration_seconds' => 3600]]),
                collect([(object) ['duration_seconds' => 600]]),
            );

        $service = new ProjectService(
            $projects,
            Mockery::mock(TaskRepository::class),
            Mockery::mock(TaskActivityService::class),
            $reports,
            Mockery::mock(ProjectTaskStatusColumnService::class),
            Mockery::mock(FinanceAnalyticsCacheService::class),
            Mockery::mock(ProjectActivityHistoryService::class),
            Mockery::mock(TaskNotificationService::class),
        );

        $details = $service->details($project);

        $this->assertSame(3600, $details['project']->weekly_seconds);
        $this->assertSame(600, $details['project']->daily_seconds);
        $this->assertSame(7200, $details['project']->total_seconds);
        $this->assertSame('current-rate', $details['project']->current_rate?->id);
        $this->assertSame(150000, $details['project']->weekly_amount);
        $this->assertArrayNotHasKey('total_seconds', $details);
    }

    public function test_update_task_returns_the_same_hydrated_shape_as_task_fetch(): void
    {
        $project = new Project([
            'id' => 'project-id',
            'status' => ProjectStatus::ACTIVE,
        ]);
        $task = new Task([
            'id' => 'task-id',
            'project_id' => 'project-id',
            'title' => 'Before update',
            'is_draft' => true,
        ]);
        $task->setRelation('assignees', new Collection);

        $updatedTask = new Task([
            'id' => 'task-id',
            'project_id' => 'project-id',
            'title' => 'After update',
            'is_draft' => true,
        ]);
        $hydratedTask = clone $updatedTask;
        $hydratedTask->setAttribute('spent_seconds', 120);

        $tasks = Mockery::mock(TaskRepository::class);
        $tasks->shouldReceive('projectMemberUserIds')
            ->once()
            ->with($project)
            ->andReturn(collect());
        $tasks->shouldReceive('updateTask')
            ->once()
            ->with($task, Mockery::on(function (array $attributes): bool {
                return ($attributes['title'] ?? null) === 'After update'
                    && ($attributes['is_client_visible'] ?? null) === true;
            }), [])
            ->andReturn($updatedTask);
        $tasks->shouldReceive('task')
            ->once()
            ->with($project, $updatedTask)
            ->andReturn($hydratedTask);

        $service = new ProjectService(
            Mockery::mock(ProjectRepository::class),
            $tasks,
            Mockery::mock(TaskActivityService::class),
            Mockery::mock(TimeReportRepository::class),
            Mockery::mock(ProjectTaskStatusColumnService::class),
            Mockery::mock(FinanceAnalyticsCacheService::class),
            Mockery::mock(ProjectActivityHistoryService::class),
            Mockery::mock(TaskNotificationService::class),
        );

        $result = $service->updateTask($project, $task, [
            'title' => 'After update',
            'is_client_visible' => true,
        ]);

        $this->assertSame($hydratedTask, $result);
        $this->assertSame(120, $result->spent_seconds);
    }
}
