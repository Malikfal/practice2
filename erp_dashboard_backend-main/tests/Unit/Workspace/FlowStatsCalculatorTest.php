<?php

namespace Tests\Unit\Workspace;

use App\Models\Company;
use App\Repositories\Workspace\Reports\FlowStatsRepository;
use App\Services\Workspace\Reports\FlowStats\FlowStatsCalculator;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Расчет статистики Flow: границы периодов в поясе компании, деление отрезков по границе,
 * внутренние проекты по is_internal и средняя неделя без дней из пропуска в данных.
 */
class FlowStatsCalculatorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...), -1);
        $this->createSchema();

        DB::table('companies')->insert([
            ['id' => 'moscow', 'timezone' => 'Europe/Moscow'],
            ['id' => 'novosibirsk', 'timezone' => 'Asia/Novosibirsk'],
        ]);
        foreach (['moscow', 'novosibirsk'] as $company) {
            DB::table('users')->insert([
                ['id' => "{$company}-ivan", 'company_id' => $company, 'name' => 'Иван', 'last_name' => 'Петров', 'email' => "ivan@{$company}.test"],
                ['id' => "{$company}-test", 'company_id' => $company, 'name' => 'Test', 'last_name' => null, 'email' => "Test@{$company}.test"],
            ]);
            DB::table('projects')->insert([
                ['id' => "{$company}-shop", 'company_id' => $company, 'name' => 'Shop', 'is_internal' => false],
                ['id' => "{$company}-erp", 'company_id' => $company, 'name' => 'ALT ERP', 'is_internal' => true],
            ]);
            DB::table('tasks')->insert([
                ['id' => "{$company}-shop-task", 'project_id' => "{$company}-shop"],
                ['id' => "{$company}-erp-task", 'project_id' => "{$company}-erp"],
            ]);
        }
    }

    protected function tearDown(): void
    {
        foreach (['work_segments', 'tasks', 'projects', 'users', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_day_week_and_month_are_counted_until_the_report_moment_in_company_timezone(): void
    {
        $this->segment('moscow', 'ivan', 'shop', '2026-11-04 09:00', 60);
        // Через полночь: в текущие сутки попадает только половина.
        $this->segment('moscow', 'ivan', 'shop', '2026-11-03 23:30', 60);
        // Отрезок идет в момент отчета: учитывается часть до 12:00.
        $this->segment('moscow', 'ivan', 'shop', '2026-11-04 11:30', 60);
        $this->segment('moscow', 'ivan', 'shop', '2026-11-02 10:00', 60);
        // Воскресенье: уже месяц, но еще прошлая неделя.
        $this->segment('moscow', 'ivan', 'shop', '2026-11-01 10:00', 60);
        $this->segment('moscow', 'ivan', 'shop', '2026-10-31 10:00', 60);

        $report = $this->calculator()->daily($this->company('moscow'), $this->at('moscow', '2026-11-04 12:00'));

        $this->assertSame([['name' => 'Shop', 'day' => 7200, 'week' => 12600, 'month' => 16200]], $report['commercial_projects']);
        $this->assertSame([['name' => 'Иван Петров', 'day' => 7200, 'week' => 12600, 'month' => 16200]], $report['developers']);
    }

    public function test_company_outside_moscow_uses_its_own_day_boundaries(): void
    {
        // 18:30 UTC — это уже 4 ноября в Новосибирске, но еще 3 ноября в Москве.
        foreach (['moscow', 'novosibirsk'] as $company) {
            DB::table('work_segments')->insert([
                'task_id' => "{$company}-shop-task",
                'user_id' => "{$company}-ivan",
                'started_at' => CarbonImmutable::parse('2026-11-03 18:30', 'UTC')->timestamp,
                'ended_at' => CarbonImmutable::parse('2026-11-03 19:30', 'UTC')->timestamp,
            ]);
        }
        // Через начало недели по Новосибирску: в неделю попадают 30 минут.
        $this->segment('novosibirsk', 'ivan', 'shop', '2026-11-01 23:30', 60);
        $moment = CarbonImmutable::parse('2026-11-04 05:00', 'UTC');

        $novosibirsk = $this->calculator()->daily($this->company('novosibirsk'), $moment)['commercial_projects'][0];
        $moscow = $this->calculator()->daily($this->company('moscow'), $moment)['commercial_projects'][0];

        $this->assertSame(['name' => 'Shop', 'day' => 3600, 'week' => 5400, 'month' => 7200], $novosibirsk);
        $this->assertSame(['name' => 'Shop', 'day' => 0, 'week' => 3600, 'month' => 3600], $moscow);
    }

    public function test_internal_projects_are_detected_by_flag_and_kept_out_of_commercial_tables(): void
    {
        $this->segment('moscow', 'ivan', 'shop', '2026-11-04 09:00', 60);
        $this->segment('moscow', 'ivan', 'erp', '2026-11-04 10:00', 30);

        $report = $this->calculator()->daily($this->company('moscow'), $this->at('moscow', '2026-11-04 12:00'));

        $this->assertSame(['Shop'], array_column($report['commercial_projects'], 'name'));
        $this->assertSame([3600], array_column($report['developers'], 'day'));
        $this->assertSame([['name' => 'ALT ERP', 'day' => 1800, 'week' => 1800, 'month' => 1800]], $report['internal_projects']);
        $this->assertSame([['name' => 'Иван Петров', 'day' => 1800, 'week' => 1800, 'month' => 1800]], $report['internal_developers']);
    }

    public function test_excluded_users_are_matched_by_email_case_insensitively(): void
    {
        config()->set('services.flow_stats.excluded_emails', ' test@moscow.test ');
        $this->segment('moscow', 'ivan', 'shop', '2026-11-04 09:00', 60);
        $this->segment('moscow', 'test', 'shop', '2026-11-04 10:00', 60);

        $report = $this->calculator()->daily($this->company('moscow'), $this->at('moscow', '2026-11-04 12:00'));

        $this->assertSame(['Иван Петров'], array_column($report['developers'], 'name'));
        $this->assertSame([3600], array_column($report['commercial_projects'], 'day'));
    }

    public function test_weekly_average_skips_days_from_the_data_gap(): void
    {
        config()->set('services.flow_stats.data_gap_from', '2026-09-10');
        config()->set('services.flow_stats.data_gap_to', '2026-11-02');
        // Окно средней для среды 04.11 — с 06.08 по 03.11. Без пропуска в нем по 5 понедельников и сред
        // и 6 вторников (06.08–09.09 ровно пять недель плюс вторник 03.11).
        $this->segment('moscow', 'ivan', 'shop', '2026-08-10 10:00', 120);
        $this->segment('moscow', 'ivan', 'shop', '2026-08-11 10:00', 180);
        $this->segment('moscow', 'ivan', 'shop', '2026-08-12 10:00', 300);
        // Четверг позже дня отчета в среднюю неделю до среды не входит.
        $this->segment('moscow', 'ivan', 'shop', '2026-08-13 10:00', 420);
        // День из пропуска не учитывается, даже если в нем есть время.
        $this->segment('moscow', 'ivan', 'shop', '2026-09-15 10:00', 600);
        $this->segment('moscow', 'ivan', 'shop', '2026-11-03 10:00', 360);
        $this->segment('moscow', 'ivan', 'shop', '2026-11-04 10:00', 180);

        $report = $this->calculator()->weekly($this->company('moscow'), $this->at('moscow', '2026-11-04 20:00'));

        // 2 ч / 5 + (3 ч + 6 ч) / 6 + 5 ч / 5 = 2.9 ч.
        $expectedAverage = 2.9 * 3600;
        $row = $report['commercial_projects']['rows'][0];
        $this->assertSame('Shop', $row['name']);
        $this->assertSame(3 * 3600 + 6 * 3600, $row['current']);
        $this->assertSame(0, $row['previous']);
        $this->assertEqualsWithDelta($expectedAverage, $row['average'], 0.001);
        $this->assertEqualsWithDelta($expectedAverage, $report['commercial_projects']['total']['average'], 0.001);
        $this->assertEqualsWithDelta($expectedAverage, $report['developers']['rows'][0]['average'], 0.001);
        $this->assertSame([], $report['internal_projects']['rows']);
        // Прошлая неделя с 26.10 по 28.10 целиком в пропуске.
        $this->assertSame(
            ['from' => '10.09.2026', 'to' => '02.11.2026', 'previous' => 'full', 'average' => true, 'weeks' => null],
            $report['gap'],
        );
    }

    public function test_weekly_rows_compare_with_previous_week_up_to_the_same_weekday(): void
    {
        $this->segment('moscow', 'ivan', 'shop', '2026-10-27 10:00', 60);
        // Среда прошлой недели входит целиком, хотя отчет строится в 12:00.
        $this->segment('moscow', 'ivan', 'shop', '2026-10-28 22:00', 60);
        // Четверг прошлой недели уже не входит.
        $this->segment('moscow', 'ivan', 'shop', '2026-10-29 10:00', 60);
        // Проект без часов на этой неделе тоже остается в таблице, чтобы итог совпадал со строками.
        $this->segment('moscow', 'ivan', 'erp', '2026-10-27 10:00', 30);
        $this->segment('moscow', 'ivan', 'shop', '2026-11-03 10:00', 30);

        $report = $this->calculator()->weekly($this->company('moscow'), $this->at('moscow', '2026-11-04 12:00'));

        $this->assertSame(1800, $report['commercial_projects']['rows'][0]['current']);
        $this->assertSame(7200, $report['commercial_projects']['rows'][0]['previous']);
        $this->assertSame(['name' => 'ALT ERP', 'current' => 0, 'previous' => 1800], array_intersect_key(
            $report['internal_projects']['rows'][0],
            ['name' => true, 'current' => true, 'previous' => true],
        ));
        $this->assertNull($report['gap']);
    }

    public function test_top_compares_last_full_week_with_the_week_before(): void
    {
        $this->segment('moscow', 'ivan', 'shop', '2026-10-20 10:00', 60);
        $this->segment('moscow', 'ivan', 'shop', '2026-10-27 10:00', 180);
        $this->segment('moscow', 'ivan', 'erp', '2026-10-21 10:00', 120);
        // Текущая неделя в сравнение не входит.
        $this->segment('moscow', 'ivan', 'shop', '2026-11-02 08:00', 600);

        $report = $this->calculator()->top($this->company('moscow'), $this->at('moscow', '2026-11-02 09:10'));

        $this->assertSame([['name' => 'Shop', 'before' => 3600, 'after' => 10800]], $report['rise']);
        $this->assertSame([['name' => 'ALT ERP', 'before' => 7200, 'after' => 0]], $report['fall']);
        $this->assertNull($report['gap']);
    }

    private function calculator(): FlowStatsCalculator
    {
        return new FlowStatsCalculator(new FlowStatsRepository);
    }

    private function company(string $id): Company
    {
        return Company::query()->findOrFail($id);
    }

    private function at(string $company, string $time): CarbonImmutable
    {
        return CarbonImmutable::parse($time, $this->company($company)->payrollTimezone());
    }

    private function segment(string $company, string $user, string $project, string $start, int $minutes): void
    {
        $startedAt = CarbonImmutable::parse($start, $this->company($company)->payrollTimezone());

        DB::table('work_segments')->insert([
            'task_id' => "{$company}-{$project}-task",
            'user_id' => "{$company}-{$user}",
            'started_at' => $startedAt->timestamp,
            'ended_at' => $startedAt->addMinutes($minutes)->timestamp,
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
            $table->string('name');
            $table->string('last_name')->nullable();
            $table->string('email');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->boolean('is_internal')->default(false);
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
    }
}
