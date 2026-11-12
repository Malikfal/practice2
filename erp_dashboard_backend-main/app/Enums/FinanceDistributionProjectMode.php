<?php

namespace App\Enums;

enum FinanceDistributionProjectMode: string
{
    case ALL = 'ALL';
    case SELECTED = 'SELECTED';

    public function label(): string
    {
        return match ($this) {
            self::ALL => 'Все проекты',
            self::SELECTED => 'Выбранные проекты',
        };
    }
}
