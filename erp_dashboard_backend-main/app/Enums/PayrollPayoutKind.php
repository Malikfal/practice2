<?php

namespace App\Enums;

enum PayrollPayoutKind: string
{
    case ADVANCE = 'ADVANCE';
    case SETTLEMENT = 'SETTLEMENT';

    public static function values(): array
    {
        return array_map(
            static fn (self $kind): string => $kind->value,
            self::cases(),
        );
    }
}
