<?php

namespace App\Enums;

use Carbon\Carbon;

enum PlannedExpenseCalculationPeriod: string
{
    case MONTH = 'MONTH';
    case QUARTER = 'QUARTER';
    case HALF_YEAR = 'HALF_YEAR';
    case YEAR = 'YEAR';

    public function label(): string
    {
        return match ($this) {
            self::MONTH => 'Месяц',
            self::QUARTER => 'Квартал',
            self::HALF_YEAR => 'Полгода',
            self::YEAR => 'Год',
        };
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    public function bounds(Carbon $date): array
    {
        $date = $date->copy()->startOfDay();

        return match ($this) {
            self::MONTH => [$date->copy()->startOfMonth(), $date->copy()->endOfMonth()],
            self::QUARTER => [$date->copy()->startOfQuarter(), $date->copy()->endOfQuarter()],
            self::HALF_YEAR => $date->month <= 6
                ? [$date->copy()->startOfYear(), $date->copy()->startOfYear()->addMonths(5)->endOfMonth()]
                : [$date->copy()->startOfYear()->addMonths(6), $date->copy()->endOfYear()],
            self::YEAR => [$date->copy()->startOfYear(), $date->copy()->endOfYear()],
        };
    }

    /**
     * @return list<array{0: Carbon, 1: Carbon}>
     */
    public function periods(Carbon $windowFrom, Carbon $windowTo): array
    {
        $periods = [];
        [$periodFrom, $periodTo] = $this->bounds($windowFrom);

        while ($periodFrom->lte($windowTo)) {
            $periods[] = [$periodFrom->copy(), $periodTo->copy()];
            [$periodFrom, $periodTo] = $this->bounds($periodTo->copy()->addDay());
        }

        return $periods;
    }
}
