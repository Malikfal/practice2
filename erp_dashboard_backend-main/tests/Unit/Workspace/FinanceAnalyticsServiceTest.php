<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceAnalyticsGranularity;
use App\Enums\FinanceArticleDistributionMethod as Method;
use App\Enums\FinanceDistributionProjectMode as Mode;
use App\Enums\FinanceType;
use App\Enums\PlannedExpenseCalculationPeriod;
use App\Enums\PlannedExpenseFormula;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\PlannedExpense;
use App\Models\Project;
use App\Models\ProjectActivityHistory;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsCompanyRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsProjectRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsWorkTimeRepository;
use App\Repositories\Workspace\PlannedExpenseRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\ActualFinanceService;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\AnalyticsInputData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DayWeightsData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\PeriodDistributionService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsFilterService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsService;
use App\Services\Workspace\FinanceAnalyticsServices\Planned\Data\PlannedExpensesData;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\ArticleTreeBuilder;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\Data\AnalyticsResultData;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\FinanceReportService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Mockery;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class FinanceAnalyticsServiceTest extends TestCase
{
    private FinanceAnalyticsOperationRepository $operations;

    private FinanceAnalyticsCompanyRepository $companies;

    private FinanceAnalyticsProjectRepository $projects;

    private FinanceAnalyticsWorkTimeRepository $workTime;

    private PlannedExpenseRepository $planned;

    private Collection $finances;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-09-08');
        config(['cache.default' => 'array']);
        Cache::flush();
        $this->operations = Mockery::mock(FinanceAnalyticsOperationRepository::class);
        $this->companies = Mockery::mock(FinanceAnalyticsCompanyRepository::class);
        $this->projects = Mockery::mock(FinanceAnalyticsProjectRepository::class);
        $this->workTime = Mockery::mock(FinanceAnalyticsWorkTimeRepository::class);
        $this->planned = Mockery::mock(PlannedExpenseRepository::class);
        $this->app->instance(FinanceAnalyticsOperationRepository::class, $this->operations);
        $this->app->instance(FinanceAnalyticsCompanyRepository::class, $this->companies);
        $this->app->instance(FinanceAnalyticsProjectRepository::class, $this->projects);
        $this->app->instance(FinanceAnalyticsWorkTimeRepository::class, $this->workTime);
        $this->app->instance(PlannedExpenseRepository::class, $this->planned);
        $this->finances = collect();
        $this->companies->shouldReceive('timezoneForCompany')->andReturn('Europe/Moscow');
        $this->operations->shouldReceive('periodBounds')->andReturn([
            Carbon::parse('2026-09-01'), Carbon::parse('2026-09-10'),
        ]);
        $projectModels = collect([
            $this->project('active', null),
            $this->project('archived', '2026-09-05'),
        ]);
        $this->projects->shouldReceive('projects')->andReturnUsing(
            static fn ($company, $ids, $clients, $managers) => $projectModels->filter(
                static fn ($project) => $ids->isEmpty() || $ids->contains($project->id),
            ),
        );
        $this->projects->shouldReceive('allocationProjects')->andReturn($projectModels);
        $this->projects->shouldReceive('projectIds')->andReturnUsing(
            static fn ($company, $ids, $clients, $managers) => $projectModels->filter(
                static fn ($project) => $ids->isEmpty() || $ids->contains($project->id),
            )->pluck('id'),
        );
        $this->operations->shouldReceive('articles')->andReturn(collect());
        $this->operations->shouldReceive('finances')->andReturnUsing(fn () => $this->finances);
        $this->operations->shouldReceive('expenseDistributionBaseFinances')->andReturnUsing(
            fn () => $this->finances->filter(fn ($finance) => $finance->employee_id !== null),
        );
        $this->workTime->shouldReceive('projectWorkedSecondsByDay')->andReturn(collect());
        $this->operations->shouldReceive('unaccountedPayments')->andReturn(collect())->byDefault();
        $this->planned->shouldReceive('active')->andReturn(collect())->byDefault();
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_shared_build_preserves_project_shares_and_keeps_plans_out_of_distribution(): void
    {
        $this->finances = collect([
            $this->finance('salary-a', 300, FinanceType::EXPENDITURE, Method::BY_TERM, 'active', 'employee'),
            $this->finance('salary-b', 100, FinanceType::EXPENDITURE, Method::BY_TERM, 'archived', 'employee'),
            $this->finance('income', 1400, FinanceType::ENTRANCE, Method::BY_TERM, mode: Mode::ALL),
            $this->finance('overhead', 800, FinanceType::EXPENDITURE, Method::PROPORTIONAL_TO_EXPENSES, mode: Mode::ALL),
            $this->finance('unallocated', 100, FinanceType::EXPENDITURE, Method::BY_TERM),
        ]);
        $this->planned->shouldReceive('active')->andReturn(collect([new PlannedExpense([
            'finance_article_id' => 'plan', 'formula' => PlannedExpenseFormula::FIXED_AMOUNT,
            'fixed_amount' => 3000, 'calculation_period' => PlannedExpenseCalculationPeriod::MONTH,
        ])]));

        $service = $this->app->make(FinanceAnalyticsService::class);
        $overview = $service->overview($this->filters(), 'company');
        $projects = collect($service->projects($this->filters(), 'company')['data'])->keyBy('project.id');
        $scoped = $service->overview($this->filters(['project_ids' => ['active']]), 'company');

        $this->assertSame(1400, $overview['summary']['income']);
        $this->assertSame(1300, $overview['summary']['actual_expenses']);
        $this->assertSame(1000, $overview['summary']['planned_expenses']);
        $this->assertSame(2300, $overview['summary']['expenses']);
        $this->assertSame(100, $overview['undistributed_expenses']);
        $this->assertSame(1000, $projects['active']['income']);
        $this->assertSame(900, $projects['active']['expenses']);
        $this->assertSame(400, $projects['archived']['income']);
        $this->assertSame(300, $projects['archived']['expenses']);
        $this->assertSame($projects['active']['income'], $scoped['summary']['income']);
        $this->assertSame($projects['active']['expenses'], $scoped['summary']['expenses']);
        $this->assertSame(1000, $scoped['summary']['company_planned_expenses']);
        $this->assertFalse($scoped['summary']['planned_expenses_included']);
        $this->assertSame(0, $scoped['summary']['planned_expenses']);
        $this->assertSame($overview['summary']['expenses'], array_sum(array_column($overview['histogram'], 'expenses')));
        $this->assertArrayNotHasKey('analytics_archived_at', $projects['archived']);
    }

    #[DataProvider('distributionMethods')]
    public function test_partial_period_preserves_full_period_rounding(Method $method): void
    {
        $finance = $this->finance('income', 10003, FinanceType::ENTRANCE, $method);
        $service = $this->app->make(PeriodDistributionService::class);
        $weights = new DayWeightsData(collect(['2026-09-02' => 1, '2026-09-05' => 3, '2026-09-09' => 2]));
        $full = $service->amountBuckets($finance, Carbon::parse('2026-09-01'), Carbon::parse('2026-09-10')->endOfDay(), FinanceAnalyticsGranularity::DAY, new DistributionWeightsData($weights, $weights));
        $partial = $service->amountBuckets($finance, Carbon::parse('2026-09-03'), Carbon::parse('2026-09-09')->endOfDay(), FinanceAnalyticsGranularity::DAY, new DistributionWeightsData($weights, $weights));

        $this->assertSame(10003, $full->sum());
        $this->assertSame($full->filter(static fn ($amount, $day) => $day >= '2026-09-03' && $day <= '2026-09-09')->all(), $partial->all());
    }

    public static function distributionMethods(): array
    {
        return array_map(static fn ($method) => [$method], Method::cases());
    }

    public function test_missing_volume_weights_warn_and_fall_back_to_term(): void
    {
        $this->finances->push($this->finance('volume-income', 1400, FinanceType::ENTRANCE, Method::BY_VOLUME, mode: Mode::ALL));
        $overview = $this->app->make(FinanceAnalyticsService::class)->overview($this->filters(), 'company');

        $this->assertSame(1400, $overview['summary']['income']);
        $this->assertSame('NO_WORK_HOURS', $overview['distribution_warnings'][0]['reason']);
        $this->assertSame('volume-income', $overview['distribution_warnings'][0]['finance_id']);
    }

    public function test_percentage_plan_uses_full_current_period_income_then_returns_visible_share(): void
    {
        $included = $this->finance('included', 1000, FinanceType::ENTRANCE, Method::BY_TERM);
        $included->finance_article_id = 'included-article';
        $excluded = $this->finance('excluded', 9000, FinanceType::ENTRANCE, Method::BY_TERM);
        $excluded->finance_article_id = 'excluded-article';
        $this->finances = collect([$included, $excluded]);
        $this->planned->shouldReceive('active')->andReturn(collect([new PlannedExpense([
            'finance_article_id' => 'plan', 'formula' => PlannedExpenseFormula::PERCENT_OF_INCOME,
            'percentage' => 10, 'income_article_ids' => ['included-article'],
            'calculation_period' => PlannedExpenseCalculationPeriod::MONTH,
        ])]));

        $result = $this->app->make(FinanceAnalyticsService::class)->overview($this->filters(['from' => '2026-09-06']), 'company');

        $this->assertSame(5000, $result['summary']['income']);
        $this->assertSame(20, $result['summary']['planned_expenses']);
        $this->assertSame(0, $result['summary']['actual_expenses']);
    }

    public function test_wide_analytics_filter_calculates_only_current_plan_period(): void
    {
        $this->planned->shouldReceive('active')->andReturn(collect([new PlannedExpense([
            'finance_article_id' => 'plan',
            'formula' => PlannedExpenseFormula::FIXED_AMOUNT,
            'fixed_amount' => 3000,
            'calculation_period' => PlannedExpenseCalculationPeriod::MONTH,
        ])]));

        $result = $this->app->make(FinanceAnalyticsService::class)->overview($this->filters([
            'from' => '2026-01-01',
            'to' => '2026-12-31',
        ]), 'company');

        $this->assertSame(3000, $result['summary']['planned_expenses']);
        $this->assertSame(3000, collect($result['histogram'])->sum('planned_expenses'));
    }

    public function test_no_eligible_projects_keeps_global_income_and_marks_expenses_undistributed(): void
    {
        $income = $this->finance('income', 1000, FinanceType::ENTRANCE, Method::BY_TERM, mode: Mode::SELECTED);
        $expense = $this->finance('expense', 300, FinanceType::EXPENDITURE, Method::BY_TERM, mode: Mode::SELECTED);
        $income->distribution_project_ids = ['missing'];
        $expense->distribution_project_ids = ['missing'];
        $this->finances = collect([$income, $expense]);
        $service = $this->app->make(FinanceAnalyticsService::class);
        $result = $service->overview($this->filters(), 'company');

        $this->assertSame(1000, $result['summary']['income']);
        $this->assertSame(300, $result['summary']['expenses']);
        $this->assertSame(300, $result['undistributed_expenses']);
        $this->assertSame([], $service->projects($this->filters(), 'company')['data']);
    }

    public function test_expense_with_explicit_project_is_direct_even_without_employee(): void
    {
        $this->finances->push($this->finance(
            'direct-project-expense',
            300,
            FinanceType::EXPENDITURE,
            Method::BY_TERM,
            project: 'active',
            mode: Mode::SELECTED,
        ));

        $service = $this->app->make(FinanceAnalyticsService::class);
        $overview = $service->overview($this->filters(), 'company');
        $project = collect($service->projects($this->filters(), 'company')['data'])->firstWhere('project.id', 'active');

        $this->assertSame(0, $overview['undistributed_expenses']);
        $this->assertSame(300, $project['direct_expenses']);
        $this->assertSame(300, $project['expenses']);
    }

    public function test_article_tree_keeps_own_amount_separate_from_child_totals(): void
    {
        $builder = $this->app->make(ArticleTreeBuilder::class);
        $type = FinanceType::ENTRANCE->value;
        $articles = collect([
            new FinanceArticle(['id' => 'article-root', 'parent_id' => null, 'name' => 'Root', 'type' => $type, 'distribution_method' => Method::BY_TERM]),
            new FinanceArticle(['id' => 'child', 'parent_id' => 'article-root', 'name' => 'Child', 'type' => $type, 'distribution_method' => Method::BY_TERM]),
        ]);
        $tree = $builder->build($type, $articles, collect(['article-root' => 100, 'child' => 300, 'without_article' => 100]), 500);
        $root = $tree->firstWhere('article_id', 'article-root');

        $this->assertSame(100, $root['own_amount']);
        $this->assertSame(300, $root['children_amount']);
        $this->assertSame(400, $root['amount']);
        $this->assertSame(80.0, $root['percent']);
        $this->assertSame(300, $root['children'][0]['amount']);
        $this->assertSame($root, unserialize(serialize($root)));
    }

    public function test_cache_is_shared_by_slices_and_invalidated_for_the_company(): void
    {
        $this->finances->push($this->finance('income', 1400, FinanceType::ENTRANCE, Method::BY_TERM, mode: Mode::ALL));
        $service = $this->app->make(FinanceAnalyticsService::class);
        $service->projects($this->filters(), 'company');
        $this->finances = collect();

        $this->assertSame(1400, $service->overview($this->filters(), 'company')['summary']['income']);
        $this->assertSame(1400, array_sum(array_column($service->clients($this->filters(), 'company')['data'], 'income')));
        $this->assertSame(1400, array_sum(array_column($service->managers($this->filters(), 'company')['data'], 'income')));
        $this->app->make(FinanceAnalyticsCacheService::class)->invalidateCompany('company');
        $this->assertSame(0, $service->overview($this->filters(), 'company')['summary']['income']);
    }

    public function test_incompatible_cached_result_is_rebuilt(): void
    {
        $filters = $this->filters();
        $normalized = $this->app->make(FinanceAnalyticsFilterService::class)->fromArray($filters);
        $key = 'finance_analytics:v5:company:1:'.sha1(json_encode([
            'timezone' => $normalized->timezone,
            'filters' => $normalized->toArray(),
        ], JSON_THROW_ON_ERROR));

        Cache::put($key, new \stdClass, 60);
        $this->finances->push($this->finance('income', 1400, FinanceType::ENTRANCE, Method::BY_TERM, mode: Mode::ALL));

        $result = $this->app->make(FinanceAnalyticsService::class)->overview($filters, 'company');
        $cached = unserialize(serialize(Cache::get($key)), ['allowed_classes' => false]);

        $this->assertSame(1400, $result['summary']['income']);
        $this->assertIsArray($cached);
        $this->assertSame(1400, AnalyticsResultData::fromCache($normalized, $cached)->summary->get('income'));
    }

    public function test_pagination_does_not_change_unaccounted_totals_or_cache_the_page(): void
    {
        $payments = collect([
            $this->finance('first', 100, FinanceType::ENTRANCE, Method::BY_TERM),
            $this->finance('second', 200, FinanceType::ENTRANCE, Method::BY_TERM),
        ]);
        $this->operations->shouldReceive('unaccountedPayments')->andReturnUsing(
            static fn ($company, $from, $to, $type) => $type === FinanceType::ENTRANCE ? $payments : collect(),
        );
        $service = $this->app->make(FinanceAnalyticsService::class);
        $first = $service->overview($this->filters(['unaccounted_per_page' => 1]), 'company');
        $second = $service->overview($this->filters(['unaccounted_per_page' => 1, 'unaccounted_income_page' => 2]), 'company');

        $this->assertSame(300, $first['unaccounted_income']['total']);
        $this->assertSame(300, $second['unaccounted_income']['total']);
        $this->assertSame(2, $second['unaccounted_income']['total_pages']);
        $this->assertSame('first', $first['unaccounted_income']['items'][0]['id']);
        $this->assertSame('second', $second['unaccounted_income']['items'][0]['id']);
        $this->assertSame($first['summary'], $second['summary']);
    }

    public function test_employee_slice_does_not_build_project_financial_summary(): void
    {
        $this->operations->shouldReceive('employeeExpenseFinances')->once()->andReturn(collect());
        $this->workTime->shouldReceive('employeeWorkedSeconds')->once()->andReturn(collect([
            (object) ['user_id' => 'employee', 'name' => 'Anna', 'last_name' => 'Smith', 'email' => null, 'duration_seconds' => 3600],
        ]));
        $this->workTime->shouldReceive('supervisedSeconds')->once()->andReturn(collect());
        $this->operations->shouldNotReceive('finances');
        $this->operations->shouldNotReceive('articles');
        $result = $this->app->make(FinanceAnalyticsService::class)->employees($this->filters(), 'company');

        $this->assertSame(0, $result['summary']['expenses']);
        $this->assertSame(3600, $result['data'][0]['own_seconds']);
        $this->assertSame('Anna Smith', $result['data'][0]['employee']['name']);
        $this->assertArrayNotHasKey('granularity', $result['filters']);
    }

    public function test_distribution_does_not_load_missing_model_relations(): void
    {
        $finance = new Finance;
        $finance->setRawAttributes(['id' => 'finance', 'amount' => 100, 'dateOfPayment' => '2026-09-01', 'employee_id' => 'employee', 'finance_article_id' => 'article']);
        $service = $this->app->make(PeriodDistributionService::class);
        $method = $finance->distributionMethod();

        $this->assertSame(Method::BY_TERM, $method);
        $this->assertSame([], $finance->getRelations());
    }

    public function test_calculation_stages_do_not_mutate_their_inputs(): void
    {
        $finance = $this->finance('income', 1400, FinanceType::ENTRANCE, Method::BY_TERM, mode: Mode::ALL);
        $filters = $this->app->make(FinanceAnalyticsFilterService::class)
            ->fromArray($this->filters(), now(), now());
        $projects = collect([$this->project('active', null), $this->project('archived', '2026-09-05')])->keyBy('id');
        $input = new AnalyticsInputData('company', $filters, collect([$finance]), $projects, $projects);
        $beforeInput = serialize($input);
        $actual = $this->app->make(ActualFinanceService::class)->calculate($input);
        $beforeActual = serialize($actual);
        $planned = new PlannedExpensesData(collect(), collect());
        $beforePlanned = serialize($planned);
        $reports = $this->app->make(FinanceReportService::class);

        $first = $reports->build($input, $actual, $planned, collect());
        $second = $reports->build($input, $actual, $planned, collect());

        $this->assertSame($beforeInput, serialize($input));
        $this->assertSame($beforeActual, serialize($actual));
        $this->assertSame($beforePlanned, serialize($planned));
        $this->assertSame($first->summary->all(), $second->summary->all());
        $this->assertSame(1400, $first->summary->get('income'));
        $this->assertSame($first->projects->all(), unserialize(serialize($first))->projects->all());
    }

    public function test_selected_project_order_preserves_the_rounding_remainder(): void
    {
        $finance = $this->finance('income', 1, FinanceType::ENTRANCE, Method::BY_TERM, mode: Mode::SELECTED);
        $finance->distribution_to = '2026-09-01';
        $finance->distribution_project_ids = ['archived', 'active'];
        $this->finances->push($finance);
        $rows = collect($this->app->make(FinanceAnalyticsService::class)
            ->projects($this->filters(['project_ids' => ['active', 'archived']]), 'company')['data'])->keyBy('project.id');

        $this->assertSame(1, $rows['archived']['income']);
        $this->assertSame(0, $rows['active']['income']);
    }

    public function test_empty_scoped_employee_selection_does_not_query_company_wide_hours(): void
    {
        $this->operations->shouldReceive('employeeExpenseFinances')->andReturn(collect());
        $this->workTime->shouldNotReceive('employeeWorkedSeconds');
        $this->workTime->shouldNotReceive('supervisedSeconds');
        $result = $this->app->make(FinanceAnalyticsService::class)->employees($this->filters(['project_ids' => ['missing']]), 'company');

        $this->assertSame([], $result['data']);
        $this->assertSame(0, $result['summary']['expenses']);
    }

    public function test_explicit_period_does_not_query_default_bounds(): void
    {
        $this->operations->shouldNotReceive('periodBounds');
        $result = $this->app->make(FinanceAnalyticsService::class)->projects($this->filters(), 'company');

        $this->assertSame('2026-09-01', $result['filters']['from']);
        $this->assertSame('2026-09-10', $result['filters']['to']);
    }

    private function filters(array $extra = []): array
    {
        return array_merge(['from' => '2026-09-01', 'to' => '2026-09-10'], $extra);
    }

    private function project(string $id, ?string $archivedAt): Project
    {
        $project = new Project(['id' => $id, 'name' => $id, 'status' => 'ACTIVE']);
        $project->setRelation('client', null);
        $project->setRelation('members', collect());
        $project->setRelation('activityHistories', collect([
            new ProjectActivityHistory([
                'started_on' => '2026-01-01',
                'ended_on' => $archivedAt,
            ]),
        ]));

        return $project;
    }

    private function finance(string $id, int $amount, FinanceType $type, Method $method, ?string $project = null, ?string $employee = null, ?Mode $mode = null): Finance
    {
        $finance = new Finance([
            'id' => $id, 'amount' => $amount, 'type' => $type, 'project_id' => $project,
            'employee_id' => $employee, 'finance_article_id' => null,
            'distribution_method' => $method, 'distribution_project_mode' => $mode,
            'distribution_project_ids' => [], 'distribution_from' => '2026-09-01',
            'distribution_to' => $employee ? '2026-09-01' : '2026-09-10', 'dateOfPayment' => '2026-09-10', 'comment' => '',
        ]);
        $finance->setRelation('article', null);
        $finance->setRelation('employee', null);

        return $finance;
    }
}
