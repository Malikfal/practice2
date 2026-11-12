<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceType;
use App\Enums\ProjectManagerPaymentMethod;
use App\Models\Company;
use App\Models\ManagerReportStat;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Workspace\Reports\ManagerReport\ManagerReportService;
use App\Services\Workspace\Reports\ManagerReport\ManagerReportStatsCollector;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * Неделя 14.09-20.09.2026 в Москве. Разработчики: d1 (Сотрудник) и d2 (Тимлид), r1 - РПО.
 * - проект A (пропорционально): PM m1 и m2, разработчик d1 4 ч, РПО r1 2 ч, сам m1 1 ч;
 * - проект B (всем целиком): m1 стал PM с четверга 17.09, d1 2 ч до этого и 3 ч после;
 * - проект C: PM m3 без оплаты PM, разработчик d2 2 ч.
 */
class ManagerReportTest extends TestCase
{
    private const TZ = 'Europe/Moscow';

    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...), -1);
        $this->createSchema();
        $this->seedWeek();

        $rates = Mockery::mock(EmployeeRateRepository::class);
        $rates->shouldReceive('excludedWorkerIds')->andReturn(collect());
        $this->app->instance(EmployeeRateRepository::class, $rates);
    }

    protected function tearDown(): void
    {
        foreach (['roles', 'project_activity_histories', 'manager_report_stats', 'finance', 'project_payroll_excluded_employees', 'employee_rates', 'project_assignment_histories', 'work_segments', 'tasks', 'projects', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_collects_hours_and_costs_of_managed_projects(): void
    {
        $this->collect();

        $a1 = $this->stat('m1', 'project-a');
        $this->assertSame(4 * 3600, $a1->developer_seconds, 'РПО и свои часы PM не входят в часы разработчиков.');
        $this->assertSame(6 * 3600, $a1->team_seconds, 'В команду входит РПО, но не PM.');
        $this->assertSame(3600, $a1->own_seconds);
        $this->assertSame(3 * 3600 + 1800, $a1->supervised_seconds, 'Часы под контролем делятся между двумя PM.');
        $this->assertSame(40000, $a1->developer_cost, 'Начисления РПО и PM не входят в расход разработчиков.');
        $this->assertSame(70000, $a1->team_cost);
        $this->assertSame(35000, $a1->controlled_cost);
        $this->assertSame(16154, $a1->manager_cost);
        $this->assertSame(0, $this->stat('m2', 'project-a')->own_seconds);

        $b1 = $this->stat('m1', 'project-b');
        $this->assertSame(3 * 3600, $b1->developer_seconds, 'До назначения PM часы проекта ему не относятся.');
        $this->assertSame(3 * 3600, $b1->supervised_seconds);
        $this->assertSame(30000, $b1->developer_cost, 'Расход проекта делится по часам разработчиков за время назначения.');
        $this->assertSame(30000, $b1->team_cost);
        $this->assertSame(13846, $b1->manager_cost);

        $this->assertSame(30000, $this->stat('m1', null)->manager_cost);
        $this->assertSame(5000, $this->stat('m2', 'project-a')->manager_cost);

        $c3 = $this->stat('m3', 'project-c');
        $this->assertSame(2 * 3600, $c3->developer_seconds);
        $this->assertSame(0, $c3->supervised_seconds, 'Без оплаты PM часов под контролем нет.');
        $this->assertSame(0, $c3->manager_cost);
        $this->assertSame(7000, $this->stat('m3', null)->manager_cost);
    }

    public function test_repeated_collection_replaces_period(): void
    {
        $this->collect();
        $this->collect();

        $this->assertSame(1, ManagerReportStat::query()->where('manager_id', 'm1')->where('project_id', 'project-a')->count());
    }

    public function test_report_calculates_costs_and_shares(): void
    {
        $this->collect();

        $report = $this->report(['granularity' => 'month']);
        $m1 = collect($report['managers'])->firstWhere('manager.id', 'm1');

        $this->assertSame('ALT Owner', $m1['manager']['name']);
        $this->assertSame('ALT Owner', collect($report['manager_options'])->firstWhere('id', 'm1')['name']);
        $this->assertSame('2026-09-14', $report['from']);
        $this->assertSame(['2026-09'], array_column($report['buckets'], 'key'));
        $this->assertSame(2, $m1['projects_count']);
        $this->assertSame(7 * 3600, $m1['developer_seconds']);
        $this->assertSame(6 * 3600 + 1800, $m1['supervised_seconds']);
        $this->assertSame(10 * 3600, $m1['total_seconds'], 'Все часы: команда 9 ч и сам менеджер 1 ч.');
        $this->assertSame(30000, $m1['manager_cost']);
        // (начисление менеджеру) / (часы под контролем): 30000 / 6.5 ч.
        $this->assertSame(4615, $m1['supervised_hour_cost']);
        // (начисления команде и менеджеру) / (все часы): (70000 + 30000 + 30000) / 10 ч.
        $this->assertSame(130000, $m1['total_cost']);
        $this->assertSame(13000, $m1['total_hour_cost']);
        // (начисления разработчикам) / (их часы): (40000 + 30000) / 7 ч.
        $this->assertSame(10000, $m1['developer_hour_cost']);
        $this->assertSame(65.0, $m1['hours_share']);
        $this->assertSame(65.0, $m1['money_share']);
        $this->assertSame(30000, $m1['series'][0]['manager_cost'], 'Распределение по проектам не удваивает начисление в графике.');
        $this->assertCount(2, $m1['projects']);

        $a1 = $m1['projects'][0];
        $this->assertSame('project-a', $a1['project']['id']);
        $this->assertSame(10000, $a1['developer_hour_cost']);
        $this->assertSame(53.85, $a1['hours_share'], 'Доли проекта считаются внутри менеджера.');
        $this->assertSame(53.85, $a1['money_share']);
        $this->assertSame(100.0, round($a1['hours_share'] + $m1['projects'][1]['hours_share'], 2));

        $this->assertSame(3, $report['summary']['projects_count']);
        $this->assertSame(9 * 3600, $report['summary']['developer_seconds'], 'Проект с двумя PM учитывается в итоге один раз.');

        $company = $report['company'];
        $this->assertSame(12 * 3600, $company['total_seconds']);
        $this->assertSame(10 * 3600, $company['supervised_seconds']);
        // (100000 команде + 42000 менеджерам) / 12 ч.
        $this->assertSame(11833, $company['total_hour_cost']);
        $this->assertSame(9 * 3600, $company['series'][0]['developer_seconds']);
        $this->assertArrayNotHasKey('hours_share', $company);
    }

    public function test_report_hides_money_without_finance_access(): void
    {
        $this->collect();

        $report = $this->report([], withFinance: false);
        $m1 = collect($report['managers'])->firstWhere('manager.id', 'm1');

        $this->assertNull($m1['manager_cost']);
        $this->assertNull($m1['supervised_hour_cost']);
        $this->assertNull($m1['developer_hour_cost']);
        $this->assertNull($m1['money_share']);
        $this->assertNull($m1['projects'][0]['developer_cost']);
        $this->assertNull($m1['series'][0]['manager_cost']);
        $this->assertNull($m1['total_hour_cost']);
        $this->assertNull($report['company']['total_cost']);
        $this->assertSame(65.0, $m1['hours_share']);
    }

    public function test_manager_filter_keeps_shares_of_whole_company(): void
    {
        $this->collect();

        $report = $this->report(['manager_ids' => ['m2'], 'granularity' => 'week']);

        $this->assertCount(1, $report['managers']);
        $this->assertSame(35.0, $report['managers'][0]['hours_share']);
        $this->assertSame(10 * 3600, $report['company']['supervised_seconds'], 'Компания не зависит от фильтра.');
        $this->assertSame(['2026-09-14'], array_column($report['buckets'], 'key'));
        $this->assertCount(3, $report['manager_options']);
    }

    public function test_week_across_months_is_split_and_summed_back(): void
    {
        DB::table('work_segments')->insert([
            $this->segment('d1', 'task-a', '2026-09-29 10:00', 2),
            $this->segment('d1', 'task-a', '2026-10-02 10:00', 6),
        ]);
        $this->app->make(ManagerReportStatsCollector::class)
            ->collectRange(Company::query()->findOrFail('company'), '2026-09-30', '2026-10-01');

        $this->assertSame(['2026-09-28', '2026-10-01'], ManagerReportStat::query()
            ->where('manager_id', 'm2')->whereNotNull('project_id')->orderBy('period_from')->get()
            ->map(fn (ManagerReportStat $stat): string => $stat->period_from->toDateString())->all());

        $week = $this->report(['from' => '2026-09-28', 'to' => '2026-10-04', 'granularity' => 'week', 'manager_ids' => ['m2']]);
        $this->assertSame(['2026-09-28'], array_column($week['buckets'], 'key'));
        $this->assertSame(8 * 3600, $week['managers'][0]['series'][0]['developer_seconds']);

        $months = $this->report(['from' => '2026-09-28', 'to' => '2026-10-04', 'granularity' => 'month', 'manager_ids' => ['m2']]);
        $this->assertSame(['Сентябрь 2026', 'Октябрь 2026'], array_column($months['buckets'], 'label'));
        $this->assertSame(['2026-09-28', '2026-10-01'], array_column($months['buckets'], 'from'));
        $this->assertSame([2 * 3600, 6 * 3600], array_column($months['managers'][0]['series'], 'developer_seconds'));
    }

    public function test_project_excluded_from_payroll_is_not_counted(): void
    {
        DB::table('projects')->where('id', 'project-c')->update([
            'exclude_from_payroll' => true,
            'payroll_exclusion_scope' => 'ALL',
        ]);
        DB::table('projects')->where('id', 'project-a')->update([
            'exclude_from_payroll' => true,
            'payroll_exclusion_scope' => 'SELECTED',
        ]);
        DB::table('project_payroll_excluded_employees')->insert(['project_id' => 'project-a', 'user_id' => 'r1']);
        $this->collect();

        $this->assertFalse(
            ManagerReportStat::query()->where('manager_id', 'm3')->exists(),
            'Проект, исключенный из оплаты для всех, не показывается, и у менеджера не остается проектов.',
        );
        $a1 = $this->stat('m1', 'project-a');
        $this->assertSame(4 * 3600, $a1->team_seconds, 'Часы исключенного сотрудника не входят в часы команды.');
        $this->assertSame(40000, $a1->team_cost, 'Его начисления по проекту тоже не учитываются.');
        $this->assertSame(2 * 3600 + 1800, $a1->supervised_seconds);
    }

    public function test_archived_project_is_shown_only_with_hours(): void
    {
        $this->collect();
        $this->assertFalse(ManagerReportStat::query()->where('project_id', 'project-archived')->exists());

        DB::table('work_segments')->insert($this->segment('d1', 'task-archived', '2026-09-16 10:00', 1));
        $this->collect();

        $archived = $this->stat('m1', 'project-archived');
        $this->assertSame(3600, $archived->developer_seconds);
        $this->assertSame(3600, $archived->supervised_seconds);
    }

    private function collect(): void
    {
        $this->app->make(ManagerReportStatsCollector::class)
            ->collectRange(Company::query()->findOrFail('company'), '2026-09-14', '2026-09-20');
    }

    /** @return array<string, mixed> */
    private function report(array $filters, bool $withFinance = true): array
    {
        return $this->app->make(ManagerReportService::class)->build(
            ['from' => '2026-09-15', 'to' => '2026-09-18', ...$filters],
            'company',
            $withFinance,
        );
    }

    private function stat(string $managerId, ?string $projectId): ManagerReportStat
    {
        return ManagerReportStat::query()
            ->where('manager_id', $managerId)
            ->when($projectId, fn ($query) => $query->where('project_id', $projectId), fn ($query) => $query->whereNull('project_id'))
            ->firstOrFail();
    }

    private function seedWeek(): void
    {
        DB::table('companies')->insert(['id' => 'company', 'status' => 'ACTIVE', 'timezone' => self::TZ]);
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'MANAGER'],
            ['id' => 2, 'name' => 'WORKER'],
            ['id' => 3, 'name' => 'TIMLID'],
            ['id' => 4, 'name' => 'RPO'],
        ]);
        DB::table('users')->insert(array_map(
            static fn (string $id, int $roleId): array => ['id' => $id, 'company_id' => 'company', 'name' => strtoupper($id), 'status' => 'ACTIVE', 'role_id' => $roleId],
            ['m2', 'm3', 'd1', 'd2', 'r1'],
            [1, 1, 2, 3, 4],
        ));
        // Фамилия не заполнена: аксессор User::last_name вернул бы «Owner», и имя задвоилось бы.
        DB::table('users')->insert(['id' => 'm1', 'company_id' => 'company', 'name' => 'ALT Owner', 'last_name' => '', 'status' => 'ACTIVE', 'role_id' => 2]);
        DB::table('projects')->insert([
            $this->project('project-a', ProjectManagerPaymentMethod::ACCRUE_PROPORTIONALLY),
            $this->project('project-b', ProjectManagerPaymentMethod::ACCRUE_ALL),
            $this->project('project-c', ProjectManagerPaymentMethod::ACCRUE_ALL),
            $this->project('project-free', ProjectManagerPaymentMethod::ACCRUE_ALL),
            $this->project('project-archived', ProjectManagerPaymentMethod::ACCRUE_ALL),
        ]);
        // Архивный проект с незакрытым назначением PM без часов не входит в число его проектов.
        DB::table('project_activity_histories')->insert([
            ['project_id' => 'project-a', 'started_on' => '2026-01-01', 'ended_on' => null],
            ['project_id' => 'project-archived', 'started_on' => '2026-01-01', 'ended_on' => '2026-09-01'],
        ]);
        DB::table('tasks')->insert([
            ['id' => 'task-a', 'project_id' => 'project-a'],
            ['id' => 'task-b', 'project_id' => 'project-b'],
            ['id' => 'task-c', 'project_id' => 'project-c'],
            ['id' => 'task-free', 'project_id' => 'project-free'],
            ['id' => 'task-archived', 'project_id' => 'project-archived'],
        ]);
        DB::table('project_assignment_histories')->insert([
            $this->assignment('m1', 'project-a', '2026-09-01', true),
            $this->assignment('m2', 'project-a', '2026-09-01', true),
            $this->assignment('m1', 'project-b', '2026-09-17', true),
            $this->assignment('m3', 'project-c', '2026-09-01', false),
            $this->assignment('m1', 'project-archived', '2026-08-01', true),
        ]);
        DB::table('work_segments')->insert([
            $this->segment('d1', 'task-a', '2026-09-15 10:00', 4),
            $this->segment('m1', 'task-a', '2026-09-15 15:00', 1),
            $this->segment('r1', 'task-a', '2026-09-15 08:00', 2),
            $this->segment('d1', 'task-b', '2026-09-14 10:00', 2),
            $this->segment('d1', 'task-b', '2026-09-18 10:00', 3),
            $this->segment('d2', 'task-c', '2026-09-16 10:00', 2),
            $this->segment('d2', 'task-free', '2026-09-16 13:00', 5),
            // Следующая неделя не входит в период.
            $this->segment('d1', 'task-a', '2026-09-21 10:00', 8),
        ]);
        DB::table('finance')->insert([
            $this->expense('d1', 'project-a', 40000),
            $this->expense('d1', 'project-b', 50000),
            $this->expense('d1', null, 1000),
            $this->expense('r1', 'project-a', 30000),
            $this->expense('m1', 'project-a', 20000),
            $this->expense('m1', 'project-b', 10000),
            $this->expense('m2', 'project-a', 5000),
            $this->expense('m3', null, 7000),
            $this->expense('d1', 'project-a', 99999, '2026-09-21'),
            $this->expense('d1', 'project-a', 88888, '2026-09-17', FinanceType::ENTRANCE),
        ]);
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('status');
            $table->string('timezone')->nullable();
        });
        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email')->nullable();
            $table->string('status');
            $table->unsignedBigInteger('role_id')->nullable();
        });
        Schema::create('roles', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('name');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->boolean('is_internal')->default(false);
            $table->string('manager_payment_method');
            $table->boolean('exclude_from_payroll')->default(false);
            $table->string('payroll_exclusion_scope')->nullable();
        });
        Schema::create('project_activity_histories', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('project_id');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
        });
        Schema::create('tasks', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
        });
        Schema::create('work_segments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('task_id');
            $table->string('user_id');
            $table->unsignedBigInteger('started_at');
            $table->unsignedBigInteger('ended_at');
        });
        Schema::create('project_assignment_histories', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('project_id');
            $table->string('user_id');
            $table->boolean('is_pm');
            $table->boolean('is_pm_payroll_enabled');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
        });
        Schema::create('employee_rates', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('employee_id');
            $table->date('effective_from');
        });
        Schema::create('project_payroll_excluded_employees', function (Blueprint $table): void {
            $table->string('project_id');
            $table->string('user_id');
        });
        Schema::create('finance', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('company_id');
            $table->string('project_id')->nullable();
            $table->string('employee_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->string('type');
            $table->date('dateOfPayment');
        });
        Schema::create('manager_report_stats', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->date('period_from');
            $table->date('period_to');
            $table->date('week_start');
            $table->string('manager_id');
            $table->string('project_id')->nullable();
            $table->unsignedBigInteger('developer_seconds');
            $table->unsignedBigInteger('team_seconds');
            $table->unsignedBigInteger('own_seconds');
            $table->unsignedBigInteger('supervised_seconds');
            $table->unsignedBigInteger('developer_cost');
            $table->unsignedBigInteger('team_cost');
            $table->unsignedBigInteger('controlled_cost');
            $table->unsignedBigInteger('manager_cost');
            $table->timestamps();
        });
    }

    /** @return array<string, mixed> */
    private function project(string $id, ProjectManagerPaymentMethod $method): array
    {
        return ['id' => $id, 'company_id' => 'company', 'name' => $id, 'manager_payment_method' => $method->value];
    }

    /** @return array<string, mixed> */
    private function assignment(string $userId, string $projectId, string $startedOn, bool $paid): array
    {
        return [
            'project_id' => $projectId,
            'user_id' => $userId,
            'is_pm' => true,
            'is_pm_payroll_enabled' => $paid,
            'started_on' => $startedOn,
            'ended_on' => null,
        ];
    }

    /** @return array<string, mixed> */
    private function segment(string $userId, string $taskId, string $start, int $hours): array
    {
        $startedAt = Carbon::parse($start, self::TZ);

        return [
            'task_id' => $taskId,
            'user_id' => $userId,
            'started_at' => $startedAt->timestamp,
            'ended_at' => $startedAt->copy()->addHours($hours)->timestamp,
        ];
    }

    /** @return array<string, mixed> */
    private function expense(
        string $employeeId,
        ?string $projectId,
        int $amount,
        string $date = '2026-09-20',
        FinanceType $type = FinanceType::EXPENDITURE,
    ): array {
        return [
            'company_id' => 'company',
            'project_id' => $projectId,
            'employee_id' => $employeeId,
            'amount' => $amount,
            'type' => $type->value,
            'dateOfPayment' => $date,
        ];
    }
}
