<?php

namespace App\Enums;

enum EmployeeAbsencePaymentMode: string
{
    case DEFAULT = 'DEFAULT';
    case FIXED = 'FIXED';

    public static function values(): array
    {
        return array_map(
            static fn (self $mode): string => $mode->value,
            self::cases(),
        );
    }
}
