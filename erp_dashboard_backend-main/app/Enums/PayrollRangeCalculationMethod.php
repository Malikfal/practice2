<?php

namespace App\Enums;

enum PayrollRangeCalculationMethod: string
{
    case THRESHOLD = 'THRESHOLD';
    case PROGRESSIVE = 'PROGRESSIVE';

    public static function values(): array
    {
        return array_map(
            static fn (self $method): string => $method->value,
            self::cases(),
        );
    }
}
