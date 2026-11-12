<?php

namespace App\Enums;

use Carbon\Carbon;

enum FinanceDistributionPeriod: string
{
    case CURRENT_DAY = 'CURRENT_DAY';
    case WEEK = 'WEEK';
    case TWO_WEEKS = 'TWO_WEEKS';
    case MONTH = 'MONTH';
    case QUARTER = 'QUARTER';
    case HALF_YEAR = 'HALF_YEAR';
    case CURRENT_YEAR = 'CURRENT_YEAR';
    case PREVIOUS_YEAR = 'PREVIOUS_YEAR';

    public function label(): string
    {
        return match ($this) {
            self::CURRENT_DAY => 'Текущий день',
            self::WEEK => 'Неделя',
            self::TWO_WEEKS => 'Две недели',
            self::MONTH => 'Месяц',
            self::QUARTER => 'Квартал',
            self::HALF_YEAR => 'Полгода',
            self::CURRENT_YEAR => 'Текущий год',
            self::PREVIOUS_YEAR => 'Прошлый год',
        };
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    public function bounds(Carbon $paymentDate): array
    {
        $date = $paymentDate->copy()->startOfDay();

        return match ($this) {
            self::CURRENT_DAY => [$date->copy(), $date->copy()],
            self::WEEK => [$date->copy()->startOfWeek(), $date->copy()->endOfWeek()],
            self::TWO_WEEKS => [
                $date->copy()->startOfWeek(),
                $date->copy()->startOfWeek()->addDays(13)->endOfDay(),
            ],
            self::MONTH => [$date->copy()->startOfMonth(), $date->copy()->endOfMonth()],
            self::QUARTER => [$date->copy()->startOfQuarter(), $date->copy()->endOfQuarter()],
            self::HALF_YEAR => $date->month <= 6
                ? [$date->copy()->startOfYear(), $date->copy()->startOfYear()->addMonths(5)->endOfMonth()]
                : [$date->copy()->startOfYear()->addMonths(6), $date->copy()->endOfYear()],
            self::CURRENT_YEAR => [$date->copy()->startOfYear(), $date->copy()->endOfYear()],
            self::PREVIOUS_YEAR => [
                $date->copy()->subYear()->startOfYear(),
                $date->copy()->subYear()->endOfYear(),
            ],
        };
    }
}
