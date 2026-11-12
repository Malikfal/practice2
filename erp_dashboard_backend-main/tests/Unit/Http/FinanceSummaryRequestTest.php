<?php

namespace Tests\Unit\Http;

use App\Http\Requests\Workspace\FinanceIndexRequest;
use App\Http\Requests\Workspace\FinanceSummaryRequest;
use Tests\TestCase;

class FinanceSummaryRequestTest extends TestCase
{
    public function test_it_contains_index_filters_without_pagination(): void
    {
        $indexRules = (new FinanceIndexRequest)->rules();
        $summaryRules = (new FinanceSummaryRequest)->rules();

        unset($indexRules['per_page']);

        $this->assertSame(array_keys($indexRules), array_keys($summaryRules));
        $this->assertArrayNotHasKey('per_page', $summaryRules);
    }
}
