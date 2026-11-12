<?php

namespace Tests\Unit\Payroll;

use App\Enums\FinanceSource;
use App\Services\Payroll\Payouts\PayrollAccrualByMonth;
use App\Services\Payroll\Payouts\PayrollPayoutCalculator;
use PHPUnit\Framework\TestCase;

class PayrollPayoutCalculatorTest extends TestCase
{
    private const SEP = '2026-09';

    private const OCT = '2026-10';

    public function test_settlement_is_accrued_minus_advance(): void
    {
        $row = $this->chain(accruals: [self::SEP => [14000000, 7500000]])[self::SEP];

        $this->assertSame(7500000, $row->advance->due);
        $this->assertSame(6500000, $row->settlement->due);
        $this->assertSame('none', $row->advance->status());
        $this->assertSame(14000000, $row->unpaid());
        $this->assertSame(0, $row->carryOut, 'Пока суммы считаются по начислению, переносить нечего.');
        $this->assertSame(14000000, $row->debtOut);
    }

    public function test_manual_settlement_carries_difference_to_next_month(): void
    {
        $chain = $this->chain(
            accruals: [self::SEP => [20166000, 9834500], self::OCT => [7751000, 7751000]],
            plans: [self::SEP => ['advance' => 9800000, 'advance_manual' => true, 'settlement' => 10300000, 'settlement_manual' => true]],
            paid: [self::SEP => ['advance' => 9800000, 'settlement' => 10300000]],
        );

        $this->assertSame('full', $chain[self::SEP]->settlement->status());
        $this->assertSame(66000, $chain[self::SEP]->carryOut);
        $this->assertSame(66000, $chain[self::OCT]->carryIn);
        $this->assertSame(66000, $chain[self::OCT]->settlement->due, 'Перенос попадает в расчет следующего месяца.');
        $this->assertSame(66000 + 7751000, $chain[self::OCT]->debtOut);
    }

    public function test_recalculation_after_fixation_goes_to_carry(): void
    {
        // Суммы закреплены при начислении 69690.00, после перерасчета стало 71415.00.
        $row = $this->chain(
            accruals: [self::SEP => [7141500, 3450000]],
            plans: [self::SEP => ['advance' => 3450000, 'advance_manual' => false, 'settlement' => 3519000, 'settlement_manual' => false]],
            paid: [self::SEP => ['advance' => 3450000, 'settlement' => 3519000]],
        )[self::SEP];

        $this->assertSame('full', $row->settlement->status());
        $this->assertSame(0, $row->unpaid());
        $this->assertSame(172500, $row->carryOut);
        $this->assertTrue($row->settlement->isFixed);
        $this->assertFalse($row->settlement->isManual);
    }

    public function test_overpayment_becomes_negative_carry(): void
    {
        $chain = $this->chain(
            accruals: [self::SEP => [7199000, 5566000]],
            plans: [self::SEP => ['advance' => 5500000, 'advance_manual' => true, 'settlement' => null, 'settlement_manual' => false]],
            paid: [self::SEP => ['advance' => 5500000, 'settlement' => 1800000]],
        );

        $this->assertSame('over', $chain[self::SEP]->settlement->status());
        $this->assertSame(101000, $chain[self::SEP]->settlement->over());
        $this->assertSame(-101000, $chain[self::SEP]->carryOut);
        $this->assertSame(0, $chain[self::OCT]->settlement->due, 'Переплата не превращается в отрицательную сумму к выплате.');
        $this->assertSame(-101000, $chain[self::OCT]->carryOut);
        $this->assertSame(-101000, $chain[self::OCT]->debtOut);
    }

    public function test_overpaid_advance_reduces_settlement_of_same_month(): void
    {
        $row = $this->chain(
            accruals: [self::SEP => [10000000, 4000000]],
            paid: [self::SEP => ['advance' => 5000000, 'settlement' => 0]],
        )[self::SEP];

        $this->assertSame('over', $row->advance->status());
        $this->assertSame(5000000, $row->settlement->due);
        $this->assertSame(5000000, $row->unpaid());
        $this->assertSame(0, $row->carryOut);
    }

    public function test_whole_month_paid_as_settlement_leaves_no_carry(): void
    {
        // Компания не платит аванс: вся сумма проведена расчетом.
        $row = $this->chain(
            accruals: [self::SEP => [10000000, 4000000]],
            paid: [self::SEP => ['advance' => 0, 'settlement' => 10000000]],
        )[self::SEP];

        $this->assertSame(0, $row->unpaid(), 'Переплата расчета закрывает невыплаченный аванс.');
        $this->assertSame(0, $row->carryOut);
        $this->assertSame(0, $row->debtOut);
        $this->assertTrue($row->isFullyPaid());
    }

    public function test_opening_balance_goes_to_first_settlement(): void
    {
        $row = $this->chain(accruals: [self::SEP => [9640000, 4615000]], opening: 1200000)[self::SEP];

        $this->assertSame(1200000, $row->carryIn);
        $this->assertSame(1200000 + 9640000 - 4615000, $row->settlement->due);
        $this->assertSame(1200000 + 9640000, $row->debtOut);
    }

    public function test_week_with_fifteenth_is_split_by_days_after_closing(): void
    {
        // 15.09.2026 - вторник: в аванс идут 2 дня из 7 закрытой недели 14-20.09.
        $closed = PayrollAccrualByMonth::fromRows([
            $this->accrual('2026-09-06', 3000000, FinanceSource::PAYROLL_RECALCULATION),
            $this->accrual('2026-09-13', 3000000, FinanceSource::PAYROLL_RECALCULATION),
            $this->accrual('2026-09-10', 500000, FinanceSource::MANUAL),
            $this->accrual('2026-09-20', 3500000, FinanceSource::PAYROLL_RECALCULATION),
            $this->accrual('2026-09-20', 700000, FinanceSource::MANUAL),
            $this->accrual('2026-09-30', 1000000, FinanceSource::PAYROLL_RECALCULATION),
        ])['e1'][self::SEP];

        $this->assertSame(11700000, $closed['accrued']);
        $this->assertSame(3000000 + 3000000 + 500000 + 1000000, $closed['first_half'], 'Ручное начисление после 15-го в аванс не входит.');

        // Пока неделя не закрыта, ее дни начислены отдельными строками и считаются по дате.
        $open = PayrollAccrualByMonth::fromRows([
            $this->accrual('2026-09-14', 500000, FinanceSource::PAYROLL_DAILY),
            $this->accrual('2026-09-15', 500000, FinanceSource::PAYROLL_DAILY),
            $this->accrual('2026-09-16', 500000, FinanceSource::PAYROLL_DAILY),
        ])['e1'][self::SEP];

        $this->assertSame(1000000, $open['first_half']);
    }

    public function test_week_ending_on_fifteenth_is_not_split(): void
    {
        // 15.11.2026 - воскресенье: неделя целиком входит в аванс по дате.
        $rows = PayrollAccrualByMonth::fromRows([
            $this->accrual('2026-11-15', 3500000, FinanceSource::PAYROLL_RECALCULATION),
            $this->accrual('2026-11-22', 3500000, FinanceSource::PAYROLL_RECALCULATION),
        ])['e1']['2026-11'];

        $this->assertSame(3500000, $rows['first_half']);
    }

    /**
     * @param  array<string, array{0:int, 1:int}>  $accruals  месяц => [начислено, за 1-15 число]
     */
    private function chain(array $accruals, array $plans = [], array $paid = [], int $opening = 0): array
    {
        return (new PayrollPayoutCalculator)->chain(
            opening: $opening,
            months: [self::SEP, self::OCT],
            accruals: array_map(static fn (array $sums): array => ['accrued' => $sums[0], 'first_half' => $sums[1]], $accruals),
            plans: $plans,
            paid: $paid,
        );
    }

    private function accrual(string $date, int $amount, FinanceSource $source): object
    {
        return (object) ['employee_id' => 'e1', 'paid_on' => $date, 'source' => $source->value, 'amount' => $amount];
    }
}
