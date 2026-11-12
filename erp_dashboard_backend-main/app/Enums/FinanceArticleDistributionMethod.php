<?php

namespace App\Enums;

enum FinanceArticleDistributionMethod: string
{
    case PROPORTIONAL_TO_EXPENSES = 'PROPORTIONAL_TO_EXPENSES';
    case BY_TERM = 'BY_TERM';
    case BY_VOLUME = 'BY_VOLUME';

    public function label(): string
    {
        return match ($this) {
            self::PROPORTIONAL_TO_EXPENSES => 'Пропорционально расходам',
            self::BY_TERM => 'По сроку',
            self::BY_VOLUME => 'По объему',
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
