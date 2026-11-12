<?php

namespace App\Enums;

enum ProjectNoteVisibility: string
{
    case PROJECT = 'project';
    case RESTRICTED = 'restricted';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(
            static fn (self $visibility): string => $visibility->value,
            self::cases(),
        );
    }
}
