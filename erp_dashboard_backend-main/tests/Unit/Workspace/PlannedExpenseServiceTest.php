<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceType;
use App\Enums\PlannedExpenseCalculationPeriod;
use App\Enums\PlannedExpenseFormula;
use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\PlannedExpense;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\PlannedExpenseRepository;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsService;
use App\Services\Workspace\PlannedExpenseService;
use Carbon\Carbon;
use Illuminate\Container\Container;
use Mockery;
use Tests\TestCase;

class PlannedExpenseServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_percentage_uses_full_current_period_income_then_returns_visible_share(): void
    {
        Carbon::setTestNow('2026-08-05 12:00:00');
        $plannedExpense = $this->plannedExpense([
            'formula' => PlannedExpenseFormula::PERCENT_OF_INCOME,
            'percentage' => 10,
            'income_article_ids' => ['income-article-2', 'income-article-1'],
        ]);
        $repository = Mockery::mock(PlannedExpenseRepository::class);
        $repository->shouldReceive('active')->once()->with('company-1')->andReturn(collect([$plannedExpense]));
        $analytics = Mockery::mock(FinanceAnalyticsService::class);
        $analytics->shouldReceive('incomeForPeriod')
            ->once()
            ->withArgs(function (Carbon $from, Carbon $to, string $companyId, array $articleIds): bool {
                return $from->toDateString() === '2026-08-01'
                    && $to->toDateString() === '2026-08-31'
                    && $companyId === 'company-1'
                    && $articleIds === ['income-article-1', 'income-article-2'];
            })
            ->andReturn(620_000);

        $rows = $this->service($repository, $analytics)->payments([
            'from' => '2026-08-01',
            'to' => '2026-08-20',
        ], 'company-1');

        $this->assertCount(1, $rows);
        $this->assertSame(620_000, $rows[0]['income_amount']);
        $this->assertSame(40_000, $rows[0]['amount']);
        $this->assertSame('2026-08-01', $rows[0]['period_from']);
        $this->assertSame('2026-08-20', $rows[0]['period_to']);
    }

    public function test_fixed_amount_is_prorated_to_visible_range(): void
    {
        Carbon::setTestNow('2026-08-05 12:00:00');
        $plannedExpense = $this->plannedExpense([
            'formula' => PlannedExpenseFormula::FIXED_AMOUNT,
            'fixed_amount' => 310_000,
        ]);
        $repository = Mockery::mock(PlannedExpenseRepository::class);
        $repository->shouldReceive('active')->once()->andReturn(collect([$plannedExpense]));
        $analytics = Mockery::mock(FinanceAnalyticsService::class);

        $rows = $this->service($repository, $analytics)->payments([
            'from' => '2026-08-10',
            'to' => '2026-08-20',
        ], 'company-1');

        $this->assertCount(1, $rows);
        $this->assertNull($rows[0]['income_amount']);
        $this->assertSame(110_000, $rows[0]['amount']);
    }

    public function test_empty_date_filters_use_each_expense_full_current_calculation_period(): void
    {
        Carbon::setTestNow('2026-08-05 12:00:00');
        $monthlyExpense = $this->plannedExpense([
            'id' => 'planned-month',
            'formula' => PlannedExpenseFormula::FIXED_AMOUNT,
            'fixed_amount' => 10_000,
        ]);
        $quarterlyExpense = $this->plannedExpense([
            'id' => 'planned-quarter',
            'calculation_period' => PlannedExpenseCalculationPeriod::QUARTER,
        ]);
        $repository = Mockery::mock(PlannedExpenseRepository::class);
        $repository->shouldReceive('active')
            ->once()
            ->andReturn(collect([$monthlyExpense, $quarterlyExpense]));
        $analytics = Mockery::mock(FinanceAnalyticsService::class);
        $analytics->shouldReceive('incomeForPeriod')
            ->once()
            ->withArgs(function (Carbon $from, Carbon $to, string $companyId, array $articleIds): bool {
                return $from->toDateString() === '2026-07-01'
                    && $to->toDateString() === '2026-09-30'
                    && $companyId === 'company-1'
                    && $articleIds === [];
            })
            ->andReturn(300_000);

        $rows = $this->service($repository, $analytics)->payments([
            'from' => '',
            'to' => '',
        ], 'company-1')->keyBy('id');

        $this->assertSame('2026-08-01', $rows['planned:planned-month:2026-08-01']['period_from']);
        $this->assertSame('2026-08-31', $rows['planned:planned-month:2026-08-01']['period_to']);
        $this->assertSame(10_000, $rows['planned:planned-month:2026-08-01']['amount']);
        $this->assertSame('2026-07-01', $rows['planned:planned-quarter:2026-07-01']['period_from']);
        $this->assertSame('2026-09-30', $rows['planned:planned-quarter:2026-07-01']['period_to']);
        $this->assertSame(30_000, $rows['planned:planned-quarter:2026-07-01']['amount']);
    }

    public function test_wide_filter_returns_only_current_calculation_period(): void
    {
        Carbon::setTestNow('2026-08-05 12:00:00');
        $plannedExpense = $this->plannedExpense([
            'formula' => PlannedExpenseFormula::FIXED_AMOUNT,
            'fixed_amount' => 31_000,
        ]);
        $repository = Mockery::mock(PlannedExpenseRepository::class);
        $repository->shouldReceive('active')->once()->andReturn(collect([$plannedExpense]));

        $rows = $this->service($repository, Mockery::mock(FinanceAnalyticsService::class))->payments([
            'from' => '2026-01-01',
            'to' => '2026-12-31',
        ], 'company-1');

        $this->assertCount(1, $rows);
        $this->assertSame('2026-08-01', $rows[0]['period_from']);
        $this->assertSame('2026-08-31', $rows[0]['period_to']);
        $this->assertSame(31_000, $rows[0]['amount']);
    }

    public function test_income_calculation_only_uses_selected_income_articles(): void
    {
        $from = Carbon::parse('2026-08-01')->startOfDay();
        $to = Carbon::parse('2026-08-20')->endOfDay();
        $repository = Mockery::mock(FinanceAnalyticsOperationRepository::class);
        $repository->shouldReceive('finances')
            ->once()
            ->with('company-1', $from, $to)
            ->andReturn(collect([
                $this->incomeFinance('income-article-1', 100_000),
                $this->incomeFinance('income-article-2', 250_000),
            ]));
        $container = new Container;
        $container->instance(FinanceAnalyticsOperationRepository::class, $repository);
        $service = $container->make(FinanceAnalyticsService::class);

        $amount = $service->incomeForPeriod(
            $from,
            $to,
            'company-1',
            ['income-article-2'],
        );

        $this->assertSame(250_000, $amount);
    }

    private function service(
        PlannedExpenseRepository $repository,
        FinanceAnalyticsService $analytics,
    ): PlannedExpenseService {
        return new PlannedExpenseService(
            $repository,
            $analytics,
            Mockery::mock(FinanceAnalyticsCacheService::class),
        );
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function plannedExpense(array $overrides): PlannedExpense
    {
        $plannedExpense = new PlannedExpense([
            'id' => 'planned-1',
            'company_id' => 'company-1',
            'finance_article_id' => 'expense-article-1',
            'formula' => PlannedExpenseFormula::PERCENT_OF_INCOME,
            'percentage' => 10,
            'fixed_amount' => null,
            'income_article_ids' => [],
            'calculation_period' => PlannedExpenseCalculationPeriod::MONTH,
            'is_active' => true,
            ...$overrides,
        ]);
        $plannedExpense->setRelation('article', new FinanceArticle([
            'id' => 'expense-article-1',
            'name' => 'Комиссия',
        ]));

        return $plannedExpense;
    }

    private function incomeFinance(string $articleId, int $amount): Finance
    {
        return new Finance([
            'type' => FinanceType::ENTRANCE->value,
            'amount' => $amount,
            'finance_article_id' => $articleId,
            'dateOfPayment' => '2026-08-10',
            'distribution_from' => '2026-08-01',
            'distribution_to' => '2026-08-20',
            'distribution_method' => 'BY_TERM',
            'project_id' => null,
            'distribution_project_mode' => null,
        ]);
    }
}
