<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceAnalyticsGranularity;
use App\Services\Workspace\FinancialResultServices\FinancialResultFilterService;
use Tests\TestCase;

class FinancialResultFilterServiceTest extends TestCase
{
    public function test_filters_are_normalized_and_reverse_period_is_swapped(): void
    {
        $filters = (new FinancialResultFilterService)->fromArray([
            'from' => '2026-09-10',
            'to' => '2026-09-01',
            'granularity' => 'week',
            'project_ids' => ['b', 'a', 'a', ''],
            'finance_article_ids' => ['article'],
            'sources' => ['MANUAL'],
            'employee_ids' => ['employee'],
        ]);

        $this->assertSame('2026-09-01', $filters->from->toDateString());
        $this->assertSame('2026-09-10', $filters->to->toDateString());
        $this->assertSame(FinanceAnalyticsGranularity::WEEK, $filters->granularity);
        $this->assertSame(['a', 'b'], $filters->projectIds->all());
        $this->assertSame(['article'], $filters->articleIds->all());
        $this->assertSame(['MANUAL'], $filters->sources->all());
        $this->assertSame(['employee'], $filters->employeeIds->all());
    }
}
