<?php

namespace App\Services\Payroll\Calculation\Rates;

use Carbon\Carbon;
use Carbon\CarbonInterface;

final class PayrollAmount
{
    private const WORKDAYS_PER_WEEK = 5;

    public static function fromSeconds(int $seconds, int $ratePerHour): int
    {
        if ($seconds <= 0 || $ratePerHour <= 0) {
            return 0;
        }

        return self::divideRounded($seconds * $ratePerHour, 3600);
    }

    public static function proportional(int $amount, int $part, int $total): int
    {
        if ($amount <= 0 || $part <= 0 || $total <= 0) {
            return 0;
        }

        return self::divideRounded($amount * $part, $total);
    }

    /**
     * Распределяет недельный оклад по пяти рабочим дням без потери остатка.
     */
    public static function weeklySalaryForDay(int $weeklyAmount, CarbonInterface $day): int
    {
        if ($weeklyAmount <= 0 || $day->isWeekend()) {
            return 0;
        }

        $base = intdiv($weeklyAmount, self::WORKDAYS_PER_WEEK);
        $remainder = $weeklyAmount % self::WORKDAYS_PER_WEEK;

        return $base + ($day->dayOfWeekIso <= $remainder ? 1 : 0);
    }

    public static function weeklySalaryForPeriod(
        int $weeklyAmount,
        CarbonInterface $from,
        CarbonInterface $to,
    ): int {
        if ($weeklyAmount <= 0) {
            return 0;
        }

        $amount = 0;
        $day = Carbon::instance($from)->copy()->startOfDay();

        while ($day->lt($to)) {
            $amount += self::weeklySalaryForDay($weeklyAmount, $day);
            $day->addDay();
        }

        return $amount;
    }

    public static function hoursToSeconds(float $hours): int
    {
        return (int) round($hours * 3600);
    }

    private static function divideRounded(int $numerator, int $denominator): int
    {
        return intdiv($numerator * 2 + $denominator, $denominator * 2);
    }
}
