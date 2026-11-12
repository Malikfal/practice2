<?php

namespace App\Enums;

enum CompanyStatus: string
{
    case ACTIVE = 'ACTIVE';
    case BLOCKED = 'BLOCKED';

    public function label(): string
    {
        return match ($this) {
            self::ACTIVE => 'Активна',
            self::BLOCKED => 'Заблокирована',
        };
    }
}
