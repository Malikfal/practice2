<?php

namespace Tests\Unit\Payroll;

use App\Services\Payroll\Calculation\Rates\PayrollAmount;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PayrollAmountTest extends TestCase
{
    /**
     * Проверяет распределение недельного оклада по пяти рабочим дням.
     */
    #[DataProvider('weeklySalaryDays')]
    public function test_weekly_salary_is_distributed_between_work_days(
        string $day,
        int $expectedAmount,
    ): void {
        $this->assertSame(
            $expectedAmount,
            PayrollAmount::weeklySalaryForDay(10_000, Carbon::parse($day)),
        );
    }

    /**
     * @return iterable<string, array{string, int}>
     */
    public static function weeklySalaryDays(): iterable
    {
        yield 'monday receives base amount' => ['2026-08-24', 2000];
        yield 'tuesday receives base amount' => ['2026-08-25', 2000];
        yield 'wednesday receives base amount' => ['2026-08-26', 2000];
        yield 'thursday receives base amount' => ['2026-08-27', 2000];
        yield 'friday receives base amount' => ['2026-08-28', 2000];
        yield 'saturday receives nothing' => ['2026-08-29', 0];
        yield 'sunday receives nothing' => ['2026-08-30', 0];
    }

    /**
     * Проверяет сохранение полной суммы оклада при расчете завершенной недели.
     */
    public function test_full_week_period_keeps_exact_weekly_salary(): void
    {
        $this->assertSame(
            10_003,
            PayrollAmount::weeklySalaryForPeriod(
                10_003,
                Carbon::parse('2026-08-24'),
                Carbon::parse('2026-08-31'),
            ),
        );
    }
}
