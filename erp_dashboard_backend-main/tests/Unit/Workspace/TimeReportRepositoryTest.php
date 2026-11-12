<?php

namespace Tests\Unit\Workspace;

use App\Repositories\Workspace\Reports\TimeReportRepository;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Фильтры проектов отчета по времени на уровне SQL: по часу работы в каждом проекте за октябрь 2026.
 */
class TimeReportRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...), -1);
        $this->createSchema();

        DB::table('users')->insert([
            ['id' => 'worker', 'company_id' => 'company-1'],
            ['id' => 'pm-1', 'company_id' => 'company-1'],
            ['id' => 'pm-2', 'company_id' => 'company-1'],
        ]);
        DB::table('projects')->insert([
            ['id' => 'commercial-a', 'company_id' => 'company-1', 'name' => 'A', 'is_internal' => false],
            ['id' => 'commercial-b', 'company_id' => 'company-1', 'name' => 'B', 'is_internal' => false],
            ['id' => 'internal-c', 'company_id' => 'company-1', 'name' => 'C', 'is_internal' => true],
        ]);
        DB::table('project_members')->insert([
            ['project_id' => 'commercial-a', 'user_id' => 'pm-1', 'is_pm' => true],
            // Участник без признака руководителя не делает проект «своим» для фильтра.
            ['project_id' => 'commercial-b', 'user_id' => 'pm-1', 'is_pm' => false],
            ['project_id' => 'commercial-b', 'user_id' => 'pm-2', 'is_pm' => true],
            ['project_id' => 'internal-c', 'user_id' => 'worker', 'is_pm' => false],
        ]);

        $start = Carbon::parse('2026-10-05 10:00', 'UTC')->timestamp;
        foreach (['commercial-a', 'commercial-b', 'internal-c'] as $projectId) {
            DB::table('tasks')->insert(['id' => "task-{$projectId}", 'project_id' => $projectId, 'title' => $projectId]);
            DB::table('work_segments')->insert([
                'task_id' => "task-{$projectId}",
                'user_id' => 'worker',
                'started_at' => $start,
                'ended_at' => $start + 3600,
            ]);
        }
    }

    protected function tearDown(): void
    {
        foreach (['project_payroll_excluded_employees', 'project_members', 'work_segments', 'tasks', 'projects', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_manager_filter_keeps_projects_where_manager_is_pm(): void
    {
        $this->assertSame(['commercial-a'], $this->projectIds(managerIds: ['pm-1']));
        $this->assertSame(['commercial-a', 'commercial-b'], $this->projectIds(managerIds: ['pm-1', 'pm-2']));
    }

    public function test_project_ids_and_project_kinds_are_combined_with_or(): void
    {
        $this->assertSame(
            ['commercial-a', 'internal-c'],
            $this->projectIds(projectIds: ['commercial-a'], projectKinds: ['internal']),
        );
        $this->assertSame(
            ['commercial-a', 'commercial-b'],
            $this->projectIds(projectIds: ['commercial-a'], projectKinds: ['commercial']),
        );
    }

    /**
     * @param  list<string>  $projectIds
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @return list<string>
     */
    private function projectIds(array $projectIds = [], array $projectKinds = [], array $managerIds = []): array
    {
        return (new TimeReportRepository)
            ->own(
                'company-1',
                Carbon::parse('2026-10-01', 'UTC'),
                Carbon::parse('2026-11-01', 'UTC'),
                'project',
                $projectIds,
                projectKinds: $projectKinds,
                managerIds: $managerIds,
            )
            ->pluck('project_id')
            ->all();
    }

    private function createSchema(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->boolean('is_internal')->nullable();
            $table->boolean('exclude_from_payroll')->default(false);
            $table->string('payroll_exclusion_scope')->nullable();
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->string('project_id');
            $table->string('user_id');
            $table->boolean('is_pm')->default(false);
        });
        Schema::create('project_payroll_excluded_employees', function (Blueprint $table): void {
            $table->string('project_id');
            $table->string('user_id');
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->string('title');
        });
        Schema::create('work_segments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('task_id');
            $table->string('user_id');
            $table->unsignedBigInteger('started_at');
            $table->unsignedBigInteger('ended_at');
        });
    }
}
