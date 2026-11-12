<?php

namespace Tests\Unit\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectActivityHistory;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use App\Services\Workspace\ProjectActivityHistoryService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ProjectActivityHistoryServiceTest extends TestCase
{
    private ProjectActivityHistoryService $service;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('timezone')->nullable();
            $table->timestamps();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('status');
            $table->timestamps();
        });
        Schema::create('project_activity_histories', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
            $table->timestamps();
        });

        Company::query()->create(['id' => 'company', 'timezone' => 'America/New_York']);
        DB::table('projects')->insert([
            'id' => 'project',
            'company_id' => 'company',
            'name' => 'Project',
            'status' => ProjectStatus::ACTIVE,
            'created_at' => '2026-09-01 12:00:00',
            'updated_at' => '2026-09-01 12:00:00',
        ]);

        $cache = Mockery::mock(FinanceAnalyticsCacheService::class);
        $cache->shouldReceive('invalidateCompany')->zeroOrMoreTimes();
        $this->service = new ProjectActivityHistoryService($cache);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        Schema::dropIfExists('project_activity_histories');
        Schema::dropIfExists('projects');
        Schema::dropIfExists('companies');

        parent::tearDown();
    }

    #[Test]
    public function status_changes_close_and_reopen_activity_in_company_timezone(): void
    {
        CarbonImmutable::setTestNow('2026-09-15 02:30:00 UTC');
        $project = Project::query()->with('company')->findOrFail('project');
        $this->service->createInitialPeriod($project);

        $period = ProjectActivityHistory::query()->where('project_id', 'project')->firstOrFail();
        $this->assertSame('2026-09-01', $period->started_on->toDateString());
        $this->assertNull($period->ended_on);

        $project->update(['status' => ProjectStatus::ARCHIVED]);
        $project->refresh()->load('company');
        $this->service->syncStatus($project, ProjectStatus::ACTIVE);

        // В New York ещё 14 сентября, хотя в UTC уже наступило 15 сентября.
        $period->refresh();
        $this->assertSame('2026-09-14', $period->ended_on?->toDateString());

        $project->update(['status' => ProjectStatus::ACTIVE]);
        $project->refresh()->load('company');
        $this->service->syncStatus($project, ProjectStatus::ARCHIVED);

        $current = ProjectActivityHistory::query()->whereNull('ended_on')->firstOrFail();
        $this->assertSame('2026-09-14', $current->started_on->toDateString());
    }

    #[Test]
    public function open_period_start_can_be_changed_but_period_cannot_be_closed_manually(): void
    {
        CarbonImmutable::setTestNow('2026-09-15 02:30:00 UTC');
        $activity = ProjectActivityHistory::query()->create([
            'id' => 'activity',
            'project_id' => 'project',
            'started_on' => '2026-09-01',
            'ended_on' => null,
        ]);

        $updated = $this->service->update($activity, ['started_on' => '2026-09-02']);
        $this->assertSame('2026-09-02', $updated->started_on->toDateString());
        $this->assertNull($updated->ended_on);

        $this->expectException(ValidationException::class);
        $this->service->update($updated, ['ended_on' => '2026-09-10']);
    }

    #[Test]
    public function activity_period_can_start_before_project_creation_date(): void
    {
        CarbonImmutable::setTestNow('2026-09-15 02:30:00 UTC');
        $activity = ProjectActivityHistory::query()->create([
            'id' => 'activity',
            'project_id' => 'project',
            'started_on' => '2026-09-01',
            'ended_on' => null,
        ]);

        $updated = $this->service->update($activity, ['started_on' => '2026-08-15']);

        $this->assertSame('2026-08-15', $updated->started_on->toDateString());
    }

    #[Test]
    public function historical_period_cannot_overlap_current_activity(): void
    {
        CarbonImmutable::setTestNow('2026-09-15 02:30:00 UTC');
        ProjectActivityHistory::query()->create([
            'id' => 'current',
            'project_id' => 'project',
            'started_on' => '2026-09-10',
            'ended_on' => null,
        ]);

        $this->expectException(ValidationException::class);
        $this->service->store([
            'project_id' => 'project',
            'started_on' => '2026-09-09',
            'ended_on' => '2026-09-12',
        ]);
    }

    #[Test]
    public function project_returns_its_latest_activity_period(): void
    {
        ProjectActivityHistory::query()->create([
            'id' => 'old-period',
            'project_id' => 'project',
            'started_on' => '2026-09-01',
            'ended_on' => '2026-09-05',
        ]);
        ProjectActivityHistory::query()->create([
            'id' => 'latest-period',
            'project_id' => 'project',
            'started_on' => '2026-09-10',
            'ended_on' => null,
        ]);

        $project = Project::query()->with('latestActivityHistory')->findOrFail('project');

        $this->assertSame('latest-period', $project->latestActivityHistory?->id);
    }
}
