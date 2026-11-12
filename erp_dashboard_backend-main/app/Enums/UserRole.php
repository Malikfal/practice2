<?php

namespace App\Enums;

enum UserRole: string
{
    case SUPERADMIN = 'SUPERADMIN';
    case ADMIN = 'ADMIN';
    case MANAGER = 'MANAGER';
    case WORKER = 'WORKER';
    case CLIENT = 'CLIENT';

    public function label(): string
    {
        return match ($this) {
            self::SUPERADMIN => 'Суперадмин',
            self::ADMIN => 'Админ',
            self::MANAGER => 'Менеджер',
            self::WORKER => 'Сотрудник',
            self::CLIENT => 'Клиент',
        };
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $role): string => $role->value,
            self::cases()
        );
    }

    public static function assignableValues(): array
    {
        return array_filter(
            self::values(),
            static fn (string $value): bool => ! in_array($value, [self::SUPERADMIN->value, self::CLIENT->value], true),
        );
    }

    public static function options(): array
    {
        return array_map(
            static fn (self $role): array => [
                'value' => $role->value,
                'label' => $role->label(),
            ],
            self::cases()
        );
    }

    public static function assignableOptions(): array
    {
        return array_values(array_filter(
            self::options(),
            static fn (array $item): bool => ! in_array(($item['value'] ?? null), [self::SUPERADMIN->value, self::CLIENT->value], true),
        ));
    }

    public static function labelByValue(string $value): ?string
    {
        return self::tryFrom($value)?->label();
    }
}
