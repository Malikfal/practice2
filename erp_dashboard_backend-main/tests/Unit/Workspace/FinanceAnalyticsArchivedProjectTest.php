<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceArticleDistributionMethod;
use App\Models\Finance;
use App\Models\Project;
use App\Models\ProjectActivityHistory;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\ProjectDistributionService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsFilterService;
use Carbon\Carbon;
use Tests\TestCase;

class FinanceAnalyticsArchivedProjectTest extends TestCase
{
    public function test_term_distribution_counts_only_days_before_project_archiving(): void
    {
        $service = $this->app->make(ProjectDistributionService::class);
        $finance = new Finance(['amount' => 1400, 'distribution_method' => FinanceArticleDistributionMethod::BY_TERM,
            'distribution_from' => '2026-09-01', 'distribution_to' => '2026-09-10']);
        $archived = new Project(['id' => 'archived']);
        $archived->setRelation('activityHistories', collect([
            new ProjectActivityHistory(['started_on' => '2026-09-01', 'ended_on' => '2026-09-05']),
        ]));
        $active = new Project(['id' => 'active']);
        $active->setRelation('activityHistories', collect([
            new ProjectActivityHistory(['started_on' => '2026-09-01', 'ended_on' => null]),
        ]));
        $projects = collect([$archived, $active]);
        $filters = (new FinanceAnalyticsFilterService)->fromArray([], Carbon::parse('2026-09-01'), Carbon::parse('2026-09-10'));
        $weights = $service->weightsForFinance($finance, $projects, $filters, new DistributionWeightsData);

        $this->assertSame(['archived' => 4, 'active' => 10], $weights->all());
    }

    public function test_term_distribution_counts_each_project_activity_period(): void
    {
        $service = $this->app->make(ProjectDistributionService::class);
        $finance = new Finance([
            'amount' => 800,
            'distribution_method' => FinanceArticleDistributionMethod::BY_TERM,
            'distribution_from' => '2026-09-01',
            'distribution_to' => '2026-09-10',
        ]);
        $project = new Project(['id' => 'reactivated']);
        $project->setRelation('activityHistories', collect([
            new ProjectActivityHistory(['started_on' => '2026-09-01', 'ended_on' => '2026-09-05']),
            new ProjectActivityHistory(['started_on' => '2026-09-07', 'ended_on' => null]),
        ]));
        $filters = (new FinanceAnalyticsFilterService)->fromArray(
            [],
            Carbon::parse('2026-09-01'),
            Carbon::parse('2026-09-10'),
        );

        $weights = $service->weightsForFinance(
            $finance,
            collect([$project]),
            $filters,
            new DistributionWeightsData,
        );

        $this->assertSame(['reactivated' => 8], $weights->all());
    }
}
