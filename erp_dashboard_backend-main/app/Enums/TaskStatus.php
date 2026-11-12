<?php

namespace App\Enums;

enum TaskStatus: string
{
    case TODO = 'TODO';
    case DONE = 'DONE';

    public function label(): string
    {
        return match ($this) {
            self::TODO => 'Сделать',
            self::DONE => 'Выполнено',
        };
    }

    public function order(): int
    {
        return match ($this) {
            self::TODO => 1,
            self::DONE => 2,
        };
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $status): string => $status->value,
            self::cases()
        );
    }

    public static function boardColumns(): array
    {
        return array_map(
            static fn (self $status): array => [
                'id' => $status->value,
                'label' => $status->label(),
                'order' => $status->order(),
            ],
            self::cases()
        );
    }
}
