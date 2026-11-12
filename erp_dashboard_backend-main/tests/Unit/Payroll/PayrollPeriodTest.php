<?php

namespace Tests\Unit\Payroll;

use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\Carbon;
use Tests\TestCase;

class PayrollPeriodTest extends TestCase
{
    public function test_sunday_closes_a_full_week_inside_one_month(): void
    {
        $period = PayrollPeriod::endingOn(Carbon::parse('2026-08-23'));

        $this->assertSame('2026-08-17', $period->from->toDateString());
        $this->assertSame('2026-08-24', $period->to->toDateString());
    }

    public function test_month_end_closes_the_first_part_of_a_week(): void
    {
        $period = PayrollPeriod::endingOn(Carbon::parse('2026-09-30'));

        $this->assertSame('2026-09-28', $period->from->toDateString());
        $this->assertSame('2026-10-01', $period->to->toDateString());
    }

    public function test_range_is_split_at_month_and_week_boundaries(): void
    {
        $periods = PayrollPeriod::between(
            Carbon::parse('2026-09-28'),
            Carbon::parse('2026-10-12'),
        );

        $this->assertSame([
            ['2026-09-28', '2026-10-01'],
            ['2026-10-01', '2026-10-05'],
            ['2026-10-05', '2026-10-12'],
        ], $periods->map(static fn (PayrollPeriod $period): array => [
            $period->from->toDateString(),
            $period->to->toDateString(),
        ])->all());
    }

    public function test_only_month_start_inside_a_week_continues_a_split_week(): void
    {
        $monthContinuation = new PayrollPeriod(
            from: Carbon::parse('2026-10-01'),
            to: Carbon::parse('2026-10-05'),
        );
        $arbitraryPartialPeriod = new PayrollPeriod(
            from: Carbon::parse('2026-10-07'),
            to: Carbon::parse('2026-10-12'),
        );

        $this->assertTrue($monthContinuation->continuesSplitWeek());
        $this->assertFalse($arbitraryPartialPeriod->continuesSplitWeek());
    }
}
