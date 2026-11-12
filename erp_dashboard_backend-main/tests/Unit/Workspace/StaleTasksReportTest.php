<?php

namespace Tests\Unit\Workspace;

use App\Enums\UserRole;
use App\Models\Task;
use App\Models\User;
use App\Services\Workspace\Reports\StaleTasksReportService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * «Сегодня» — 27.10.2026 12:00 по Москве. Без движения с 24.10 включительно (3 дня) задача попадает в отчёт,
 * граница — 25.10 00:00 по Москве, то есть 24.10 21:00 UTC.
 */
class StaleTasksReportTest extends TestCase
{
    private const TZ = 'Europe/Moscow';

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-10-27 12:00', self::TZ));
        $this->createSchema();

        DB::table('companies')->insert([
            ['id' => 'company-1', 'timezone' => self::TZ],
            ['id' => 'company-2', 'timezone' => self::TZ],
        ]);
        DB::table('users')->insert([
            ['id' => 'u1', 'company_id' => 'company-1'],
            ['id' => 'u2', 'company_id' => 'company-1'],
            ['id' => 'pm', 'company_id' => 'company-1'],
        ]);
        DB::table('projects')->insert([
            ['id' => 'project-a', 'company_id' => 'company-1', 'name' => 'A', 'status' => 'ACTIVE', 'is_internal' => false],
            ['id' => 'project-b', 'company_id' => 'company-1', 'name' => 'B', 'status' => 'ACTIVE', 'is_internal' => true],
            ['id' => 'project-archived', 'company_id' => 'company-1', 'name' => 'Archived', 'status' => 'ARCHIVED', 'is_internal' => false],
            ['id' => 'project-other', 'company_id' => 'company-2', 'name' => 'Other', 'status' => 'ACTIVE', 'is_internal' => false],
        ]);
        DB::table('project_members')->insert([
            ['project_id' => 'project-b', 'user_id' => 'pm', 'is_pm' => true],
        ]);
        DB::table('task_status_columns')->insert([
            ['id' => 'a-todo', 'project_id' => 'project-a', 'name' => 'Сделать', 'color' => '#111', 'position' => 1, 'is_final' => false],
            ['id' => 'a-progress', 'project_id' => 'project-a', 'name' => 'В работе', 'color' => '#222', 'position' => 2, 'is_final' => false],
            ['id' => 'a-done', 'project_id' => 'project-a', 'name' => 'Готово', 'color' => '#333', 'position' => 3, 'is_final' => true],
            ['id' => 'b-progress', 'project_id' => 'project-b', 'name' => 'В работе ', 'color' => '#444', 'position' => 2, 'is_final' => false],
            ['id' => 'archived-review', 'project_id' => 'project-archived', 'name' => 'Ревью', 'color' => null, 'position' => 1, 'is_final' => false],
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        foreach ([
            'activity_log', 'task_comments', 'task_attachments', 'work_segments', 'task_users', 'tasks',
            'task_status_columns', 'project_members', 'projects', 'users', 'companies',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_task_is_stale_from_three_calendar_days_in_company_timezone(): void
    {
        $this->task('week-old', 'project-a', 'a-todo', '2026-10-20 10:00');
        $this->task('three-days', 'project-a', 'a-todo', '2026-10-24 20:59');
        $this->task('two-days', 'project-a', 'a-todo', '2026-10-24 21:00');

        $rows = $this->report()['rows'];

        $this->assertSame(['week-old', 'three-days'], $rows->pluck('task_id')->all(), 'Сверху — дольше всех без движения.');
        $this->assertSame([
            'project_id' => 'project-a',
            'project_name' => 'A',
            'task_id' => 'three-days',
            'task_name' => 'three-days',
            'status_name' => 'Сделать',
            'status_color' => '#111',
            'spent_seconds' => 0,
            'last_moved_at' => '2026-10-24T20:59:00+00:00',
            'last_moved_on' => '2026-10-24',
            'idle_days' => 3,
        ], $rows->last(), '23:59 по Москве 24.10 — это уже три дня.');
        $this->assertSame(7, $rows->first()['idle_days']);
    }

    public function test_any_explicit_event_counts_as_movement_but_updated_at_does_not(): void
    {
        foreach (['by-history', 'by-comment', 'by-attachment', 'by-tracking', 'only-updated-at', 'old-events'] as $id) {
            $this->task($id, 'project-a', 'a-progress', '2026-10-01 10:00', updatedAt: '2026-10-27 08:00');
        }

        $this->activity('by-history', '2026-10-26 09:00');
        $this->comment('by-comment', '2026-10-25 09:00');
        $this->attachment('by-attachment', '2026-10-26 15:00');
        $this->segment('by-tracking', 'u1', '2026-10-24 20:00', 3600);

        $this->activity('old-events', '2026-10-15 10:00');
        $this->comment('old-events', '2026-10-18 10:00');
        $this->segment('old-events', 'u1', '2026-10-22 08:00', 1800);
        $this->segment('old-events', 'u2', '2026-10-10 08:00', 3600);

        $rows = $this->report()['rows']->keyBy('task_id');

        $this->assertSame(['old-events', 'only-updated-at'], $rows->keys()->sort()->values()->all());
        $this->assertSame('2026-10-22T08:30:00+00:00', $rows['old-events']['last_moved_at'], 'Конец последнего сегмента трекинга.');
        $this->assertSame(5400, $rows['old-events']['spent_seconds'], 'Затрачено — за всю задачу по всем сотрудникам.');
        $this->assertSame('2026-10-01', $rows['only-updated-at']['last_moved_on'], 'updated_at сдвигают пересчёты позиций, он не движение.');
    }

    public function test_only_active_published_tasks_of_active_company_projects(): void
    {
        $this->task('no-status', 'project-a', null, '2026-10-01 10:00');
        $this->task('final', 'project-a', 'a-done', '2026-10-01 10:00');
        $this->task('draft', 'project-a', 'a-todo', '2026-10-01 10:00', isDraft: true);
        $this->task('archived-project', 'project-archived', 'archived-review', '2026-10-01 10:00');
        $this->task('other-company', 'project-other', null, '2026-10-01 10:00');

        $report = $this->report();

        $this->assertSame(['no-status'], $report['rows']->pluck('task_id')->all());
        $this->assertNull($report['rows']->first()['status_name']);
        $this->assertSame(
            ['Сделать', 'В работе'],
            $report['available_statuses'],
            'Финальные статусы и статусы архивных проектов в фильтр не попадают, одноимённые объединяются.',
        );
    }

    public function test_filters_by_status_names_assignees_project_kinds_and_managers(): void
    {
        $this->task('a-todo-task', 'project-a', 'a-todo', '2026-10-01 10:00', assignees: ['u1']);
        $this->task('a-progress-task', 'project-a', 'a-progress', '2026-10-02 10:00', assignees: ['u2']);
        $this->task('b-progress-task', 'project-b', 'b-progress', '2026-10-03 10:00', assignees: ['u1', 'u2']);

        $this->assertSame(
            ['a-progress-task', 'b-progress-task'],
            $this->report(['status_names' => ['В работе']])['rows']->pluck('task_id')->all(),
            'Статус выбирается по названию во всех проектах, пробелы по краям не важны.',
        );
        $this->assertSame(
            ['a-todo-task', 'b-progress-task'],
            $this->report(['user_ids' => ['u1']])['rows']->pluck('task_id')->all(),
            'Сотрудник — исполнитель задачи.',
        );
        $this->assertSame(['b-progress-task'], $this->report(['project_kinds' => ['internal']])['rows']->pluck('task_id')->all());
        $this->assertSame(['b-progress-task'], $this->report(['manager_ids' => ['pm']])['rows']->pluck('task_id')->all());
        $this->assertSame(['a-todo-task'], $this->report(['task_ids' => ['a-todo-task']])['rows']->pluck('task_id')->all());
    }

    public function test_manager_sees_only_assigned_projects(): void
    {
        $this->task('a-task', 'project-a', 'a-todo', '2026-10-01 10:00');
        $this->task('b-task', 'project-b', 'b-progress', '2026-10-01 10:00');

        $report = $this->report([], $this->managerAssignedTo(['project-b']));

        $this->assertSame(['b-task'], $report['rows']->pluck('task_id')->all());
        $this->assertSame(['В работе'], $report['available_statuses']);
        $this->assertSame(
            [],
            $this->report(['project_kinds' => ['commercial']], $this->managerAssignedTo(['project-b']))['rows']->all(),
            'Тип проекта не расширяет выбор за пределы проектов менеджера.',
        );
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function report(array $filters = [], ?User $actor = null): array
    {
        return app(StaleTasksReportService::class)->build($filters, 'company-1', $actor);
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

    /**
     * @param  list<string>  $assignees
     */
    private function task(
        string $id,
        string $projectId,
        ?string $columnId,
        string $createdAtUtc,
        bool $isDraft = false,
        ?string $updatedAt = null,
        array $assignees = [],
    ): void {
        DB::table('tasks')->insert([
            'id' => $id,
            'project_id' => $projectId,
            'title' => $id,
            'task_status_column_id' => $columnId,
            'is_draft' => $isDraft,
            'created_at' => $createdAtUtc.':00',
            'updated_at' => ($updatedAt ?? $createdAtUtc).':00',
        ]);

        foreach ($assignees as $userId) {
            DB::table('task_users')->insert(['task_id' => $id, 'user_id' => $userId]);
        }
    }

    private function activity(string $taskId, string $createdAtUtc): void
    {
        DB::table('activity_log')->insert([
            'log_name' => 'task',
            'description' => 'Изменен статус задачи',
            'event' => 'status_updated',
            'subject_type' => (new Task)->getMorphClass(),
            'subject_id' => $taskId,
            'created_at' => $createdAtUtc.':00',
        ]);
        // Запись о другой сущности с тем же id не двигает задачу.
        DB::table('activity_log')->insert([
            'log_name' => 'project',
            'description' => 'Другая сущность',
            'event' => 'updated',
            'subject_type' => 'App\\Models\\Project',
            'subject_id' => $taskId,
            'created_at' => '2026-10-27 08:00:00',
        ]);
    }

    private function comment(string $taskId, string $createdAtUtc): void
    {
        DB::table('task_comments')->insert(['task_id' => $taskId, 'created_at' => $createdAtUtc.':00']);
    }

    private function attachment(string $taskId, string $createdAtUtc): void
    {
        DB::table('task_attachments')->insert(['task_id' => $taskId, 'created_at' => $createdAtUtc.':00']);
    }

    private function segment(string $taskId, string $userId, string $startedAtUtc, int $seconds): void
    {
        $start = Carbon::parse($startedAtUtc, 'UTC')->timestamp;

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
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('status')->default('ACTIVE');
            $table->boolean('is_internal')->default(false);
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->string('project_id');
            $table->string('user_id');
            $table->boolean('is_pm')->default(false);
        });
        Schema::create('task_status_columns', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->string('name');
            $table->string('color')->nullable();
            $table->integer('position')->default(0);
            $table->boolean('is_final')->default(false);
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->string('title');
            $table->string('task_status_column_id')->nullable();
            $table->boolean('is_draft')->default(false);
            $table->timestamps();
        });
        Schema::create('task_users', function (Blueprint $table): void {
            $table->string('task_id');
            $table->string('user_id');
        });
        Schema::create('activity_log', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('log_name')->nullable();
            $table->text('description');
            $table->string('event')->nullable();
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            $table->timestamps();
        });
        Schema::create('task_comments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('task_id');
            $table->timestamps();
        });
        Schema::create('task_attachments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('task_id');
            $table->timestamps();
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
