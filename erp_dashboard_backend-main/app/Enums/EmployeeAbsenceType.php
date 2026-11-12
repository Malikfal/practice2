<?php

namespace App\Enums;

enum EmployeeAbsenceType: string
{
    case VACATION = 'VACATION';
    case DAY_OFF = 'DAY_OFF';
    case SICK_LEAVE = 'SICK_LEAVE';
    // Выходной, назначенный админом на конкретную дату; оплата задается способом оплаты отсутствия.
    case WEEKEND = 'WEEKEND';

    public static function values(): array
    {
        return array_map(
            static fn (self $type): string => $type->value,
            self::cases(),
        );
    }
}
