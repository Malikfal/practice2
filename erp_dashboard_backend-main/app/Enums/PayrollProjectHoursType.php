<?php

namespace App\Enums;

enum PayrollProjectHoursType: string
{
    case ALL = 'ALL';
    case COMMERCIAL = 'COMMERCIAL';
    case INTERNAL = 'INTERNAL';

    public static function values(): array
    {
        return array_map(
            static fn (self $type): string => $type->value,
            self::cases(),
        );
    }
}
