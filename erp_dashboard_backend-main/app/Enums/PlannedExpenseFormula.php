<?php

namespace App\Enums;

enum PlannedExpenseFormula: string
{
    case PERCENT_OF_INCOME = 'PERCENT_OF_INCOME';
    case FIXED_AMOUNT = 'FIXED_AMOUNT';

    public function label(): string
    {
        return match ($this) {
            self::PERCENT_OF_INCOME => 'Процент от доходов',
            self::FIXED_AMOUNT => 'Фиксированная сумма',
        };
    }
}
