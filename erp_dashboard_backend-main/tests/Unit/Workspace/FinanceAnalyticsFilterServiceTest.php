<?php

namespace Tests\Unit\Workspace;

use App\Enums\FinanceAnalyticsGranularity;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsFilterService;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FinanceAnalyticsFilterServiceTest extends TestCase
{
    #[Test]
    public function missing_from_uses_earliest_available_data_date(): void
    {
        $filters = (new FinanceAnalyticsFilterService)->fromArray(
            ['to' => '2026-09-08'],
            Carbon::parse('2024-11-01'),
            Carbon::parse('2026-09-07'),
        );

        $this->assertSame('2024-11-01', $filters->from->toDateString());
        $this->assertSame('2026-09-08', $filters->to->toDateString());
    }

    #[Test]
    public function missing_to_uses_latest_available_data_date(): void
    {
        $filters = (new FinanceAnalyticsFilterService)->fromArray(
            ['from' => '2026-03-15'],
            Carbon::parse('2024-11-01'),
            Carbon::parse('2026-09-07'),
        );

        $this->assertSame('2026-03-15', $filters->from->toDateString());
        $this->assertSame('2026-09-07', $filters->to->toDateString());
    }

    #[Test]
    public function filters_use_company_timezone_and_granularity_enum(): void
    {
        $filters = (new FinanceAnalyticsFilterService)->fromArray(
            ['from' => '2026-03-08', 'to' => '2026-03-08', 'granularity' => 'week'],
            timezone: 'America/New_York',
        );

        $this->assertSame('America/New_York', $filters->timezone);
        $this->assertSame('America/New_York', $filters->from->timezoneName);
        $this->assertSame('America/New_York', $filters->to->timezoneName);
        $this->assertSame(FinanceAnalyticsGranularity::WEEK, $filters->granularity);
        $this->assertSame(82_799, $filters->to->timestamp - $filters->from->timestamp);
    }
}
