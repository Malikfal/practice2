<?php

namespace Tests\Unit\Workspace;

use App\Enums\UserRole;
use App\Models\User;
use App\Services\Workspace\Reports\TimeReportService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * Период отчета — октябрь 2026 в Москве, допустимое время для задач без оценки — 3 ч.
 */
class OverrunReportTest extends TestCase
{
    private const TZ = 'Europe/Moscow';

    protected function setUp(): void
    {
        parent::setUp();

        $this->createSchema();
        DB::table('companies')->insert([
            ['id' => 'company-1', 'timezone' => self::TZ, 'unestimated_task_limit_seconds' => 3 * 3600],
            ['id' => 'company-2', 'timezone' => self::TZ, 'unestimated_task_limit_seconds' => 3 * 3600],
        ]);
        DB::table('users')->insert([
            ['id' => 'u1', 'company_id' => 'company-1'],
            ['id' => 'u2', 'company_id' => 'company-1'],
            ['id' => 'other-user', 'company_id' => 'company-2'],
        ]);
        DB::table('projects')->insert([
            ['id' => 'project-a', 'company_id' => 'company-1', 'name' => 'A', 'is_internal' => false, 'exclude_from_payroll' => true, 'payroll_exclusion_scope' => 'ALL'],
            ['id' => 'project-b', 'company_id' => 'company-1', 'name' => 'B', 'is_internal' => true, 'exclude_from_payroll' => false, 'payroll_exclusion_scope' => null],
            ['id' => 'project-other', 'company_id' => 'company-2', 'name' => 'Other', 'is_internal' => false, 'exclude_from_payroll' => false, 'payroll_exclusion_scope' => null],
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['project_members', 'work_segments', 'tasks', 'projects', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_counts_whole_task_time_and_compares_strictly_with_estimate(): void
    {
        $this->task('over-with-history', 'project-a', 2 * 3600);
        $this->segment('over-with-history', 'u1', '2026-09-20 10:00', 3600);
        $this->segment('over-with-history', 'u2', '2026-10-05 10:00', 5400);

        $this->task('exactly-estimate', 'project-a', 2 * 3600);
        $this->segment('exactly-estimate', 'u1', '2026-10-06 10:00', 2 * 3600);

        $this->task('over-before-period', 'project-a', 3600);
        $this->segment('over-before-period', 'u1', '2026-09-10 10:00', 5 * 3600);

        $this->task('other-company', 'project-other', 3600);
        $this->segment('other-company', 'other-user', '2026-10-07 10:00', 2 * 3600);

        $report = $this->overrun();

        $this->assertSame(['over-with-history'], $report['rows']->pluck('task_id')->all());
        $this->assertSame([
            'project_id' => 'project-a',
            'project_name' => 'A',
            'task_id' => 'over-with-history',
            'task_name' => 'over-with-history',
            'estimation_seconds' => 2 * 3600,
            'spent_seconds' => 9000,
        ], $report['rows']->first(), 'Время до периода тоже входит, проект исключен из зарплаты, но остается в отчете.');
        $this->assertSame(9000, $report['spent_seconds']);
    }

    public function test_tasks_without_estimate_need_more_than_company_limit(): void
    {
        $this->task('no-estimate-at-limit', 'project-b', null);
        $this->segment('no-estimate-at-limit', 'u1', '2026-10-05 10:00', 3 * 3600);

        $this->task('no-estimate-over-limit', 'project-b', null);
        $this->segment('no-estimate-over-limit', 'u1', '2026-10-05 14:00', 3 * 3600 + 1800);

        $this->task('zero-estimate', 'project-b', 0);
        $this->segment('zero-estimate', 'u1', '2026-10-06 10:00', 4 * 3600);

        $report = $this->overrun();

        $this->assertSame(['no-estimate-over-limit', 'zero-estimate'], $report['rows']->pluck('task_id')->all());
        $this->assertNull($report['rows']->first()['estimation_seconds']);
        $this->assertSame(3 * 3600, $report['unestimated_task_limit_seconds']);

        DB::table('companies')->where('id', 'company-1')->update(['unestimated_task_limit_seconds' => 4 * 3600]);

        $this->assertSame([], $this->overrun()['rows']->pluck('task_id')->all());
    }

    public function test_employee_filter_selects_tasks_but_spent_time_includes_everyone(): void
    {
        $this->task('shared', 'project-a', 3600);
        $this->segment('shared', 'u1', '2026-10-05 10:00', 3600);
        $this->segment('shared', 'u2', '2026-10-06 10:00', 1800);

        $this->task('only-u1', 'project-a', 3600);
        $this->segment('only-u1', 'u1', '2026-10-07 10:00', 2 * 3600);

        $rows = $this->overrun(['user_ids' => ['u2']])['rows'];

        $this->assertSame(['shared'], $rows->pluck('task_id')->all());
        $this->assertSame(5400, $rows->first()['spent_seconds']);
    }

    public function test_project_kind_filter_is_applied(): void
    {
        $this->task('commercial', 'project-a', 3600);
        $this->segment('commercial', 'u1', '2026-10-05 10:00', 2 * 3600);

        $this->task('internal', 'project-b', 3600);
        $this->segment('internal', 'u1', '2026-10-05 13:00', 2 * 3600);

        $this->assertSame(['internal'], $this->overrun(['project_kinds' => ['internal']])['rows']->pluck('task_id')->all());
    }

    public function test_manager_sees_only_assigned_projects_even_with_project_kind_filter(): void
    {
        $this->task('commercial', 'project-a', 3600);
        $this->segment('commercial', 'u1', '2026-10-05 10:00', 2 * 3600);

        $this->task('internal', 'project-b', 3600);
        $this->segment('internal', 'u1', '2026-10-05 13:00', 2 * 3600);

        $this->assertSame(['internal'], $this->overrun([], $this->managerAssignedTo(['project-b']))['rows']->pluck('task_id')->all());
        $this->assertSame(
            [],
            $this->overrun(['project_kinds' => ['commercial']], $this->managerAssignedTo(['project-b']))['rows']->pluck('task_id')->all(),
            'Тип проекта не расширяет выбор за пределы проектов менеджера.',
        );
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function overrun(array $filters = [], ?User $actor = null): array
    {
        return app(TimeReportService::class)->overrun(
            ['from' => '2026-10-01', 'to' => '2026-10-31', ...$filters],
            'company-1',
            $actor,
        );
    }

    /**
     * @param  list<string>  $projectIds
     */
    private function managerAssignedTo(array $projectIds): User
    {
        $actor = Mockery::mock(User::class)->makePartial();
        $actor->setRawAttributes(['id' => 'manager-1', 'role' => UserRole::MANAGER->value]);
        $actor->shouldReceive('assignedProjectIds')->once()->andReturn(collect($projectIds));

        return $actor;
    }

    private function task(string $id, string $projectId, ?int $estimation): void
    {
        DB::table('tasks')->insert(['id' => $id, 'project_id' => $projectId, 'title' => $id, 'estimation' => $estimation]);
    }

    private function segment(string $taskId, string $userId, string $startedAt, int $seconds): void
    {
        $start = Carbon::parse($startedAt, self::TZ)->timestamp;

        DB::table('work_segments')->insert([
            'task_id' => $taskId,
            'user_id' => $userId,
            'started_at' => $start,
            'ended_at' => $start + $seconds,
        ]);
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('timezone')->nullable();
            $table->unsignedInteger('unestimated_task_limit_seconds')->default(3 * 3600);
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->boolean('is_internal')->default(false);
            $table->boolean('exclude_from_payroll')->default(false);
            $table->string('payroll_exclusion_scope')->nullable();
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->string('project_id');
            $table->string('user_id');
            $table->boolean('is_pm')->default(false);
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->string('title');
            $table->integer('estimation')->nullable();
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
