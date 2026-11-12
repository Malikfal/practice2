<?php

namespace App\Enums;

enum PayrollHoursScope: string
{
    case OWN = 'OWN';
    case SUPERVISED = 'SUPERVISED';
    case COMPANY = 'COMPANY';

    public static function values(): array
    {
        return array_map(
            static fn (self $scope): string => $scope->value,
            self::cases(),
        );
    }
}
