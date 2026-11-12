<?php

namespace Tests\Unit\Workspace;

use App\Enums\UserRole;
use App\Http\Requests\Workspace\LimitReportRequest;
use App\Http\Requests\Workspace\UpdateClientRequest;
use App\Http\Requests\Workspace\UpdateProjectRequest;
use App\Models\User;
use App\Services\Workspace\Reports\LimitReportService;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Mockery;
use Tests\TestCase;

/**
 * Неделя отчёта — 5–11 октября 2026 в Москве, две недели — 5–18 октября.
 */
class LimitReportTest extends TestCase
{
    private const TZ = 'Europe/Moscow';

    private const HOUR = 3600;

    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...), -1);
        $this->createSchema();

        DB::table('companies')->insert([
            ['id' => 'company-1', 'timezone' => self::TZ],
            ['id' => 'company-2', 'timezone' => self::TZ],
        ]);
        DB::table('users')->insert([
            ['id' => 'u1', 'company_id' => 'company-1'],
            ['id' => 'u2', 'company_id' => 'company-1'],
            ['id' => 'other-user', 'company_id' => 'company-2'],
        ]);
        DB::table('clients')->insert([
            ['id' => 'client-limited', 'company_id' => 'company-1', 'name' => 'Бета', 'weekly_limit_seconds' => 10 * self::HOUR],
            ['id' => 'client-free', 'company_id' => 'company-1', 'name' => 'Альфа', 'weekly_limit_seconds' => null],
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['project_members', 'work_segments', 'tasks', 'projects', 'clients', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_project_limit_is_scaled_to_period(): void
    {
        $this->project('own', 'Свой лимит', limit: 15 * self::HOUR);
        $this->segment('own', 'u1', '2026-10-06 10:00', 20 * self::HOUR);

        $row = $this->report(['from' => '2026-10-05', 'to' => '2026-10-18'])['rows']->sole();

        $this->assertSame('project', $row['limit_source']);
        $this->assertSame(15 * self::HOUR, $row['weekly_limit_seconds']);
        $this->assertSame(30 * self::HOUR, $row['limit_seconds'], '15 ч в неделю за две недели — 30 ч.');
        $this->assertSame(20 * self::HOUR, $row['spent_seconds']);
        $this->assertSame(20 * self::HOUR, $row['limit_spent_seconds']);

        $tenDays = $this->report(['from' => '2026-10-05', 'to' => '2026-10-14']);
        $this->assertSame(10, $tenDays['period_days']);
        $this->assertSame((int) round(15 * self::HOUR * 10 / 7), $tenDays['rows']->sole()['limit_seconds']);
    }

    public function test_client_limit_wins_and_is_shared_by_client_projects(): void
    {
        $this->project('a', 'A', clientId: 'client-limited', limit: 50 * self::HOUR);
        $this->project('b', 'B', clientId: 'client-limited');
        $this->segment('a', 'u1', '2026-10-05 10:00', 6 * self::HOUR);
        $this->segment('b', 'u2', '2026-10-06 10:00', 7 * self::HOUR);

        $report = $this->report();
        $rows = $report['rows']->keyBy('project_id');

        foreach (['a', 'b'] as $projectId) {
            $this->assertSame('client', $rows[$projectId]['limit_source']);
            $this->assertSame(10 * self::HOUR, $rows[$projectId]['limit_seconds']);
            $this->assertSame(13 * self::HOUR, $rows[$projectId]['limit_spent_seconds'], 'Лимит клиента расходуют все его проекты.');
        }
        $this->assertSame(50 * self::HOUR, $rows['a']['project_weekly_limit_seconds'], 'Лимит проекта виден, но не действует.');
        $this->assertSame(10 * self::HOUR, $report['limit_seconds'], 'Общий лимит клиента в итоге считается один раз.');
        $this->assertSame(13 * self::HOUR, $report['spent_seconds']);
    }

    public function test_group_by_client_sums_client_projects_and_puts_projects_without_client_last(): void
    {
        $this->project('limited-1', 'L1', clientId: 'client-limited');
        $this->project('limited-2', 'L2', clientId: 'client-limited');
        $this->project('free', 'F', clientId: 'client-free', limit: 5 * self::HOUR);
        $this->project('no-client', 'N', limit: 8 * self::HOUR);
        $this->segment('limited-1', 'u1', '2026-10-05 10:00', 4 * self::HOUR);
        $this->segment('limited-2', 'u1', '2026-10-06 10:00', 8 * self::HOUR);
        $this->segment('free', 'u1', '2026-10-07 10:00', 2 * self::HOUR);

        $report = $this->report(['group_by' => 'client']);
        $clients = $report['rows']->values();

        $this->assertSame(['client-free', 'client-limited', null], $clients->pluck('client_id')->all());
        $this->assertNull($clients[0]['limit_seconds'], 'У клиента без лимита строка без лимита, лимиты у проектов.');
        $this->assertSame(5 * self::HOUR, $clients[0]['projects'][0]['limit_seconds']);
        $this->assertSame(10 * self::HOUR, $clients[1]['limit_seconds']);
        $this->assertSame(12 * self::HOUR, $clients[1]['spent_seconds']);
        $this->assertSame(['limited-1', 'limited-2'], array_column($clients[1]['projects'], 'project_id'));
        $this->assertSame(0, $clients[2]['spent_seconds']);
        $this->assertSame((10 + 5 + 8) * self::HOUR, $report['limit_seconds']);
    }

    public function test_totals_keep_overrun_and_unused_limit_apart(): void
    {
        // Клиент: лимит 10 ч, у его двух проектов 9 + 3 = 12 ч — сверх 2 ч, а не 2 ч в каждой строке.
        $this->project('limited-1', 'L1', clientId: 'client-limited', limit: 50 * self::HOUR);
        $this->project('limited-2', 'L2', clientId: 'client-limited');
        // Свой лимит 8 ч, потрачено 3 ч — запас 5 ч; свой лимит 4 ч, потрачено 4 ч — ровно в лимите.
        $this->project('own-free', 'Запас', limit: 8 * self::HOUR);
        $this->project('own-exact', 'Ровно', limit: 4 * self::HOUR);
        $this->segment('limited-1', 'u1', '2026-10-05 10:00', 9 * self::HOUR);
        $this->segment('limited-2', 'u1', '2026-10-06 10:00', 3 * self::HOUR);
        $this->segment('own-free', 'u1', '2026-10-07 10:00', 3 * self::HOUR);
        $this->segment('own-exact', 'u1', '2026-10-08 10:00', 4 * self::HOUR);

        foreach (['project', 'client'] as $groupBy) {
            $report = $this->report(['group_by' => $groupBy]);

            $this->assertSame((10 + 8 + 4) * self::HOUR, $report['limit_seconds'], $groupBy);
            $this->assertSame((12 + 3 + 4) * self::HOUR, $report['spent_seconds'], $groupBy);
            $this->assertSame(2 * self::HOUR, $report['over_limit_seconds'], "{$groupBy}: превышение клиента учтено один раз.");
            $this->assertSame(5 * self::HOUR, $report['remaining_seconds'], "{$groupBy}: запас не уменьшается превышением другого лимита.");
        }
    }

    public function test_only_limited_projects_and_archived_ones_only_with_time(): void
    {
        $this->project('unlimited', 'Без лимита', clientId: 'client-free');
        $this->project('idle-active', 'Активный без времени', limit: self::HOUR);
        $this->project('idle-archived', 'Архив без времени', limit: self::HOUR, status: 'ARCHIVED');
        $this->project('busy-archived', 'Архив со временем', limit: self::HOUR, status: 'ARCHIVED');
        $this->segment('unlimited', 'u1', '2026-10-05 10:00', self::HOUR);
        $this->segment('busy-archived', 'u1', '2026-10-05 12:00', self::HOUR);

        $this->assertSame(['idle-active', 'busy-archived'], $this->report()['rows']->pluck('project_id')->all());
    }

    public function test_time_is_clamped_to_period_and_other_company_is_ignored(): void
    {
        $this->project('own', 'Свой', limit: 10 * self::HOUR);
        // 23:00 воскресенья до периода — 03:00 понедельника: в отчёт попадают 3 часа.
        $this->segment('own', 'u1', '2026-10-04 23:00', 4 * self::HOUR);
        $this->segment('own', 'other-user', '2026-10-06 10:00', 5 * self::HOUR);

        $this->assertSame(3 * self::HOUR, $this->report()['rows']->sole()['spent_seconds']);
    }

    public function test_employee_filter_keeps_projects_with_their_time_only(): void
    {
        $this->project('with-u2', 'С u2', limit: 10 * self::HOUR);
        $this->project('only-u1', 'Только u1', limit: 10 * self::HOUR);
        $this->segment('with-u2', 'u1', '2026-10-05 10:00', self::HOUR);
        $this->segment('with-u2', 'u2', '2026-10-05 12:00', 2 * self::HOUR);
        $this->segment('only-u1', 'u1', '2026-10-06 10:00', self::HOUR);

        $row = $this->report(['user_ids' => ['u2']])['rows']->sole();

        $this->assertSame('with-u2', $row['project_id']);
        $this->assertSame(2 * self::HOUR, $row['spent_seconds']);
    }

    public function test_manager_sees_only_assigned_projects(): void
    {
        $this->project('mine', 'Мой', limit: self::HOUR);
        $this->project('foreign', 'Чужой', limit: self::HOUR);

        $actor = Mockery::mock(User::class)->makePartial();
        $actor->setRawAttributes(['id' => 'manager-1', 'role' => UserRole::MANAGER->value]);
        $actor->shouldReceive('assignedProjectIds')->once()->andReturn(collect(['mine']));

        $this->assertSame(['mine'], $this->report([], $actor)['rows']->pluck('project_id')->all());
    }

    public function test_requests_validate_group_and_weekly_limit(): void
    {
        $groupRules = ['group_by' => (new LimitReportRequest)->rules()['group_by']];
        $this->assertTrue(Validator::make(['group_by' => 'client'], $groupRules)->passes());
        $this->assertFalse(Validator::make(['group_by' => 'day'], $groupRules)->passes());

        foreach ([new UpdateClientRequest, new UpdateProjectRequest] as $request) {
            $rules = ['weekly_limit_seconds' => $request->rules()['weekly_limit_seconds']];

            $this->assertTrue(Validator::make(['weekly_limit_seconds' => null], $rules)->passes(), 'Пусто — лимит не задан.');
            $this->assertTrue(Validator::make(['weekly_limit_seconds' => 15 * self::HOUR + 1800], $rules)->passes());
            $this->assertFalse(Validator::make(['weekly_limit_seconds' => -1], $rules)->passes());
            $this->assertFalse(Validator::make(['weekly_limit_seconds' => 1.5], $rules)->passes());
        }
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    private function report(array $filters = [], ?User $actor = null): array
    {
        return app(LimitReportService::class)->build(
            ['from' => '2026-10-05', 'to' => '2026-10-11', 'group_by' => 'project', ...$filters],
            'company-1',
            $actor,
        );
    }

    private function project(
        string $id,
        string $name,
        ?string $clientId = null,
        ?int $limit = null,
        string $status = 'ACTIVE',
    ): void {
        DB::table('projects')->insert([
            'id' => $id,
            'company_id' => 'company-1',
            'client_id' => $clientId,
            'name' => $name,
            'status' => $status,
            'weekly_limit_seconds' => $limit,
        ]);
        DB::table('tasks')->insert(['id' => "task-{$id}", 'project_id' => $id, 'title' => $name]);
    }

    private function segment(string $projectId, string $userId, string $startedAt, int $seconds): void
    {
        $start = Carbon::parse($startedAt, self::TZ)->timestamp;

        DB::table('work_segments')->insert([
            'task_id' => "task-{$projectId}",
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
        Schema::create('clients', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->unsignedInteger('weekly_limit_seconds')->nullable();
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('client_id')->nullable();
            $table->string('name');
            $table->string('status')->default('ACTIVE');
            $table->boolean('is_internal')->default(false);
            $table->unsignedInteger('weekly_limit_seconds')->nullable();
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
