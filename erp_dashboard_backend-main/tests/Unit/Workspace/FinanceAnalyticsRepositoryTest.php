<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceType;
use App\Models\Finance;
use App\Models\Project;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsProjectRepository;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class FinanceAnalyticsRepositoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('projects', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('company_id');
            $table->string('client_id')->nullable();
        });
        Schema::create('project_activity_histories', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->date('started_on');
            $table->date('ended_on')->nullable();
        });
        Schema::create('project_members', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('project_id');
            $table->string('user_id');
            $table->boolean('is_pm');
        });
        Schema::create('finance_article', function (Blueprint $table): void {
            $table->string('id')->primary();
            $table->string('name');
            $table->string('distribution_method')->nullable();
        });
        DB::table('projects')->insert([
            ['id' => 'one', 'name' => 'A', 'company_id' => 'company', 'client_id' => 'client'],
            ['id' => 'two', 'name' => 'B', 'company_id' => 'company', 'client_id' => null],
            ['id' => 'foreign', 'name' => 'C', 'company_id' => 'other-company', 'client_id' => 'client'],
        ]);
        DB::table('project_activity_histories')->insert([
            ['id' => 'one-active', 'project_id' => 'one', 'started_on' => '2026-01-01', 'ended_on' => null],
            ['id' => 'two-active', 'project_id' => 'two', 'started_on' => '2026-01-01', 'ended_on' => '2026-09-05'],
        ]);
        DB::table('project_members')->insert([
            ['id' => 'pm', 'project_id' => 'one', 'user_id' => 'manager', 'is_pm' => true],
            ['id' => 'worker', 'project_id' => 'two', 'user_id' => 'manager', 'is_pm' => false],
        ]);
    }

    public function test_project_ids_apply_all_filters_without_loading_relations(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $ids = $this->app->make(FinanceAnalyticsProjectRepository::class)->projectIds(
            'company', collect(['one', 'two', 'foreign']), collect(['client']), collect(['manager']),
        );

        $this->assertSame(['one'], $ids->all());
        $this->assertCount(1, DB::getQueryLog());
    }

    public function test_allocation_projects_are_models_with_only_required_columns(): void
    {
        DB::enableQueryLog();
        DB::flushQueryLog();
        $projects = $this->app->make(FinanceAnalyticsProjectRepository::class)->allocationProjects('company');

        $this->assertCount(2, $projects);
        $this->assertInstanceOf(Project::class, $projects->first());
        $this->assertSame(['id'], array_keys($projects->first()->getAttributes()));
        $this->assertSame(['activityHistories'], array_keys($projects->first()->getRelations()));
        $this->assertSame('2026-09-05', $projects->last()->activityHistories->first()->ended_on->toDateString());
        $this->assertCount(2, DB::getQueryLog());
    }

    public function test_finances_return_cast_models_and_use_distribution_overlap(): void
    {
        Schema::create('finance', function (Blueprint $table): void {
            $table->string('id')->primary();
            foreach (['company_id', 'type', 'project_id', 'finance_article_id', 'employee_id', 'comment', 'distribution_method', 'distribution_project_mode', 'distribution_project_ids'] as $column) {
                $table->string($column)->nullable();
            }
            $table->integer('amount');
            $table->date('dateOfPayment');
            $table->date('distribution_from')->nullable();
            $table->date('distribution_to')->nullable();
        });
        DB::table('finance')->insert([
            ['id' => 'inside', 'company_id' => 'company', 'type' => FinanceType::ENTRANCE->value, 'amount' => 300,
                'dateOfPayment' => '2026-10-01', 'distribution_from' => '2026-09-01', 'distribution_to' => '2026-09-30'],
            ['id' => 'outside', 'company_id' => 'company', 'type' => FinanceType::ENTRANCE->value, 'amount' => 100,
                'dateOfPayment' => '2026-08-01', 'distribution_from' => null, 'distribution_to' => null],
        ]);
        $rows = $this->app->make(FinanceAnalyticsOperationRepository::class)->finances('company', Carbon::parse('2026-09-03'), Carbon::parse('2026-09-09'));

        $this->assertCount(1, $rows);
        $this->assertInstanceOf(Finance::class, $rows->first());
        $this->assertSame(FinanceType::ENTRANCE, $rows->first()->type);
        $this->assertSame(300, $rows->first()->amount);
        $this->assertTrue($rows->first()->relationLoaded('article'));
        $this->assertTrue($rows->first()->relationLoaded('employee'));
    }

    public function test_direct_project_expense_is_not_unaccounted_without_employee(): void
    {
        Schema::create('finance', function (Blueprint $table): void {
            $table->string('id')->primary();
            foreach (['company_id', 'type', 'project_id', 'finance_article_id', 'employee_id', 'comment', 'distribution_method', 'distribution_project_mode', 'distribution_project_ids'] as $column) {
                $table->string($column)->nullable();
            }
            $table->integer('amount');
            $table->date('dateOfPayment');
            $table->date('distribution_from')->nullable();
            $table->date('distribution_to')->nullable();
        });
        DB::table('finance')->insert([
            ['id' => 'direct', 'company_id' => 'company', 'type' => FinanceType::EXPENDITURE->value,
                'project_id' => 'one', 'employee_id' => null, 'amount' => 300, 'distribution_method' => 'BY_TERM',
                'dateOfPayment' => '2026-09-05', 'distribution_from' => '2026-09-01', 'distribution_to' => '2026-09-10'],
            ['id' => 'without-project', 'company_id' => 'company', 'type' => FinanceType::EXPENDITURE->value,
                'project_id' => null, 'employee_id' => null, 'amount' => 100, 'distribution_method' => 'BY_TERM',
                'dateOfPayment' => '2026-09-05', 'distribution_from' => '2026-09-01', 'distribution_to' => '2026-09-10'],
        ]);

        $rows = $this->app->make(FinanceAnalyticsOperationRepository::class)->unaccountedPayments(
            'company', Carbon::parse('2026-09-01'), Carbon::parse('2026-09-10'), FinanceType::EXPENDITURE,
        );

        $this->assertSame(['without-project'], $rows->pluck('id')->all());
    }
}
