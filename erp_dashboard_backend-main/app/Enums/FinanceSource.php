<?php

namespace App\Enums;

enum FinanceSource: string
{
    case PAYROLL_DAILY = 'PAYROLL_DAILY';
    case PAYROLL_RECALCULATION = 'PAYROLL_RECALCULATION';
    case MANUAL = 'MANUAL';
    case IMPORT = 'IMPORT';

    public static function values(): array
    {
        return array_map(
            static fn (self $source): string => $source->value,
            self::cases(),
        );
    }
}
