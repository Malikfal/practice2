<?php

namespace App\Enums;

enum ProjectPayrollExclusionScope: string
{
    case ALL = 'ALL';
    case SELECTED = 'SELECTED';

    public static function values(): array
    {
        return array_map(
            static fn (self $scope): string => $scope->value,
            self::cases(),
        );
    }
}
