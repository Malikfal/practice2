<?php

namespace Tests\Unit\Workspace;

use App\Repositories\Workspace\EmployeeRepository;
use App\Support\CurrentWeek;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmployeeRepositorySortingTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        DB::connection()->getPdo()->sqliteCreateFunction('GREATEST', max(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('LEAST', min(...), -1);
        DB::connection()->getPdo()->sqliteCreateFunction('SPLIT_PART', static fn ($value, $separator, $part) => explode($separator, $value)[$part - 1] ?? '', 3);

        Schema::create('users', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('name');
            $table->string('last_name')->nullable();
            $table->string('email');
            $table->string('status');
            $table->integer('role_id')->nullable();
            $table->string('position')->nullable();
            $table->timestamps();
        });
        // Часы "за день" считаются по часовому поясу компании.
        Schema::create('companies', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('timezone')->nullable();
        });
        Schema::create('roles', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('name');
            $table->string('display_name')->nullable();
        });
        Schema::create('work_segments', function (Blueprint $table): void {
            $table->increments('id');
            $table->string('user_id');
            $table->integer('started_at');
            $table->integer('ended_at');
        });
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('company_id');
            $table->string('status');
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->string('user_id');
            $table->string('project_id');
        });

        foreach (['a', 'b', 'c', 'd'] as $id) {
            DB::table('users')->insert([
                'id' => $id, 'company_id' => 'company', 'name' => 'Alex '.$id,
                'last_name' => 'Same', 'email' => "$id@example.test", 'status' => 'ACTIVE',
                'created_at' => '2026-09-15 00:00:00', 'updated_at' => '2026-09-15 00:00:00',
            ]);
        }
        DB::table('projects')->insert([
            ['id' => 'p1', 'company_id' => 'company', 'status' => 'ACTIVE'],
            ['id' => 'p2', 'company_id' => 'company', 'status' => 'ACTIVE'],
            ['id' => 'p3', 'company_id' => 'company', 'status' => 'ARCHIVED'],
        ]);
        DB::table('project_members')->insert([
            ['user_id' => 'a', 'project_id' => 'p1'],
            ['user_id' => 'a', 'project_id' => 'p2'],
            ['user_id' => 'b', 'project_id' => 'p1'],
            ['user_id' => 'c', 'project_id' => 'p3'],
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        foreach (['project_members', 'projects', 'work_segments', 'roles', 'companies', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
        parent::tearDown();
    }

    public function test_projects_sort_uses_active_memberships_before_pagination_in_both_directions(): void
    {
        $repository = new EmployeeRepository;

        foreach (['asc' => [['c', 'd'], ['b', 'a']], 'desc' => [['a', 'b'], ['c', 'd']]] as $direction => $pages) {
            foreach ($pages as $number => $ids) {
                Paginator::currentPageResolver(static fn () => $number + 1);
                $page = $repository->paginate('company', 'active', '', 2, 'projects', $direction);
                $this->assertSame(4, $page->total());
                $this->assertSame($ids, $page->getCollection()->pluck('id')->all());
            }
        }
    }

    public function test_each_supported_sort_field_keeps_ties_stable_across_pages(): void
    {
        $repository = new EmployeeRepository;

        foreach (['last_name', 'first_name', 'role', 'position', 'created_at', 'last_date_activity', 'total_seconds_for_week'] as $field) {
            foreach (['asc', 'desc'] as $direction) {
                Paginator::currentPageResolver(static fn () => 1);
                $first = $repository->paginate('company', 'active', '', 2, $field, $direction);
                Paginator::currentPageResolver(static fn () => 2);
                $second = $repository->paginate('company', 'active', '', 2, $field, $direction);

                $this->assertSame(['a', 'b', 'c', 'd'], array_merge(
                    $first->getCollection()->pluck('id')->all(),
                    $second->getCollection()->pluck('id')->all(),
                ), "$field $direction");
            }
        }
    }

    public function test_sort_direction_and_filters_are_applied_to_the_full_result(): void
    {
        DB::table('users')->where('id', 'a')->update([
            'name' => 'Zoe a', 'last_name' => 'Zulu', 'position' => 'Z position',
            'created_at' => '2026-09-16 00:00:00',
        ]);
        DB::table('users')->where('id', 'd')->update(['status' => 'BLOCKED']);
        DB::table('work_segments')->insert([
            'user_id' => 'a', 'started_at' => 10, 'ended_at' => 20,
        ]);

        $repository = new EmployeeRepository;
        foreach (['first_name', 'last_name', 'position', 'created_at', 'last_date_activity'] as $field) {
            Paginator::currentPageResolver(static fn () => 1);
            $asc = $repository->paginate('company', 'active', '', 2, $field, 'asc');
            $desc = $repository->paginate('company', 'active', '', 2, $field, 'desc');

            $this->assertSame(3, $asc->total());
            $expectedAsc = in_array($field, ['position', 'last_date_activity'], true)
                ? ['a', 'b'] : ['b', 'c'];
            $this->assertSame($expectedAsc, $asc->getCollection()->pluck('id')->all(), $field);
            $this->assertSame('a', $desc->getCollection()->first()->id, $field);
        }

        $filtered = $repository->paginate('company', 'active', 'Zoe', 2, 'projects', 'asc');
        $this->assertSame(1, $filtered->total());
        $this->assertSame(['a'], $filtered->getCollection()->pluck('id')->all());
    }

    public function test_week_time_sort_counts_only_current_week(): void
    {
        // Понедельник 01:00 по Москве: неделя компании уже началась, а по UTC еще идет прошлая.
        DB::table('companies')->insert(['id' => 'company', 'timezone' => 'Europe/Moscow']);
        Carbon::setTestNow(Carbon::parse('2026-07-12 22:00:00', 'UTC'));
        $weekStart = CurrentWeek::bounds('company')[0]->timestamp;
        DB::table('work_segments')->insert([
            // Время до начала недели не учитывается.
            ['user_id' => 'a', 'started_at' => $weekStart - 36000, 'ended_at' => $weekStart - 3600],
            ['user_id' => 'b', 'started_at' => $weekStart + 3600, 'ended_at' => $weekStart + 3 * 3600],
            ['user_id' => 'c', 'started_at' => $weekStart - 1800, 'ended_at' => $weekStart + 3600],
        ]);

        Paginator::currentPageResolver(static fn () => 1);
        $repository = new EmployeeRepository;
        $this->assertSame(['b', 'c', 'a', 'd'], $repository->paginate('company', 'active', '', 4, 'total_seconds_for_week', 'desc')
            ->getCollection()->pluck('id')->all());
        $this->assertSame(['a', 'd', 'c', 'b'], $repository->paginate('company', 'active', '', 4, 'total_seconds_for_week', 'asc')
            ->getCollection()->pluck('id')->all());
    }

    public function test_role_sort_uses_the_resolved_role_name(): void
    {
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'WORKER'],
            ['id' => 2, 'name' => 'ADMIN'],
        ]);
        DB::table('users')->where('id', 'a')->update(['role_id' => 1]);
        DB::table('users')->where('id', 'b')->update(['role_id' => 2]);

        Paginator::currentPageResolver(static fn () => 1);
        $repository = new EmployeeRepository;
        $this->assertSame(['b', 'a'], $repository->paginate('company', 'active', '', 2, 'role', 'asc')
            ->getCollection()->pluck('id')->all());
        $this->assertSame(['a', 'b'], $repository->paginate('company', 'active', '', 2, 'role', 'desc')
            ->getCollection()->pluck('id')->all());
    }
}
