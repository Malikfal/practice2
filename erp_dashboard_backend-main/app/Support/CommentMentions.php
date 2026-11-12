<?php

namespace App\Support;

/**
 * Упоминания в тексте комментария. Панель сохраняет их как @[Имя Фамилия](id пользователя).
 */
class CommentMentions
{
    private const PATTERN = '/@\[([^\]\n]{1,100})\]\(([0-9a-fA-F-]{36})\)/u';

    /**
     * @return array<int, string>
     */
    public static function userIds(?string $text): array
    {
        if ($text === null || $text === '' || ! preg_match_all(self::PATTERN, $text, $matches)) {
            return [];
        }

        return array_values(array_unique(array_map('strtolower', $matches[2])));
    }

    /**
     * Текст для уведомлений и истории: @[Имя](id) превращается в @Имя.
     */
    public static function toPlainText(?string $text): ?string
    {
        if ($text === null) {
            return null;
        }

        return preg_replace(self::PATTERN, '@$1', $text) ?? $text;
    }
}
