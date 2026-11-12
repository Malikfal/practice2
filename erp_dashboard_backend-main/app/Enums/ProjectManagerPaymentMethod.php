<?php

namespace App\Enums;

enum ProjectManagerPaymentMethod: string
{
    case ACCRUE_ALL = 'ACCRUE_ALL';
    case DO_NOT_ACCRUE = 'DO_NOT_ACCRUE';
    case ACCRUE_PROPORTIONALLY = 'ACCRUE_PROPORTIONALLY';

    public function label(): string
    {
        return match ($this) {
            self::ACCRUE_ALL => 'Начислять всем',
            self::DO_NOT_ACCRUE => 'Не начислять',
            self::ACCRUE_PROPORTIONALLY => 'Начислять пропорционально',
        };
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $method): string => $method->value,
            self::cases(),
        );
    }
}
