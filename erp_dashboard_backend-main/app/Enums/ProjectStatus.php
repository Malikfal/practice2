<?php

namespace App\Enums;

enum ProjectStatus: string
{
    case ACTIVE = 'ACTIVE';
    case ARCHIVED = 'ARCHIVED';

    public function label(): string
    {
        return match ($this) {
            self::ACTIVE => 'Активный',
            self::ARCHIVED => 'Архив',
        };
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $status): string => $status->value,
            self::cases()
        );
    }

    public static function labelByValue(string $value): ?string
    {
        return self::tryFrom($value)?->label();
    }
}
