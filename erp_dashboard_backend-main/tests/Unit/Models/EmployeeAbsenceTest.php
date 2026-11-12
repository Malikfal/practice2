<?php

namespace Tests\Unit\Models;

use App\Models\EmployeeAbsence;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class EmployeeAbsenceTest extends TestCase
{
    #[DataProvider('calculationCases')]
    public function test_it_applies_coefficient_to_fixed_daily_amount(
        ?string $coefficient,
        int $expectedAmount,
        int $fixedDailyAmount = 1000,
    ): void {
        $absence = new EmployeeAbsence([
            'fixed_daily_amount' => $fixedDailyAmount,
            'coefficient' => $coefficient,
        ]);

        $this->assertSame($expectedAmount, $absence->calculatedFixedDailyAmount());
    }

    public static function calculationCases(): array
    {
        return [
            'fractional coefficient' => ['0.5', 500],
            'double coefficient' => ['2', 2000],
            'coefficient equals one' => ['1', 1000],
            'empty coefficient defaults to one' => [null, 1000],
            'fractional kopecks are rounded half up' => ['0.5', 501, 1001],
        ];
    }
}
