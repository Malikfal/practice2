<?php

namespace App\Enums;

enum FinanceType: string
{
    case ENTRANCE = 'ENTRANCE';
    case EXPENDITURE = 'EXPENDITURE';

    public function label(): string
    {
        return match ($this) {
            self::ENTRANCE => 'Поступление',
            self::EXPENDITURE => 'Расход',
        };
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $type): string => $type->value,
            self::cases(),
        );
    }
}
