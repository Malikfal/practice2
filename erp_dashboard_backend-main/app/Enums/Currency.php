<?php

namespace App\Enums;

/**
 * Валюта почасовой ставки проекта.
 */
enum Currency: string
{
    case RUB = 'RUB';
    case EUR = 'EUR';
    case USD = 'USD';

    public function symbol(): string
    {
        return match ($this) {
            self::RUB => '₽',
            self::EUR => '€',
            self::USD => '$',
        };
    }
}
