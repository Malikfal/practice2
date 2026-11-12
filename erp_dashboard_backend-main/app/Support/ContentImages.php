<?php

namespace App\Support;

/**
 * Поиск и правка картинок в HTML заметок, статей и описаний задач.
 */
final class ContentImages
{
    private const IMG_TAG = '/<img\b[^>]*>/i';

    private const SRC_ATTRIBUTE = '/(\ssrc\s*=\s*)("([^"]*)"|\'([^\']*)\')/i';

    private const REMOVED = "\u{0}removed-image\u{0}";

    /**
     * Внешние картинки: http(s)-ссылки на любые хосты, кроме своих.
     *
     * @param  list<string>  $ownHosts
     * @return list<string>
     */
    public static function externalSources(string $html, array $ownHosts): array
    {
        $ownHosts = array_map('strtolower', $ownHosts);
        $sources = [];

        preg_match_all(self::IMG_TAG, $html, $tags);
        foreach ($tags[0] as $tag) {
            $src = self::source($tag);
            $host = strtolower((string) parse_url((string) $src, PHP_URL_HOST));

            if ($src !== null && preg_match('#^https?://#i', $src) && $host !== '' && ! in_array($host, $ownHosts, true)) {
                $sources[$src] = true;
            }
        }

        return array_keys($sources);
    }

    public static function replaceSource(string $html, string $src, string $newSrc): string
    {
        return self::mapTags($html, $src, static fn (string $tag): string => preg_replace_callback(
            self::SRC_ATTRIBUTE,
            static fn (array $match): string => $match[1].'"'.htmlspecialchars($newSrc, ENT_QUOTES).'"',
            $tag,
            1,
        ) ?? $tag);
    }

    /**
     * Убирает картинку, а если она была единственным содержимым абзаца — и сам абзац.
     */
    public static function removeImage(string $html, string $src): string
    {
        $html = self::mapTags($html, $src, static fn (): string => self::REMOVED);
        $marker = preg_quote(self::REMOVED, '#');
        $html = preg_replace('#<p\b[^>]*>(?:\s|<br\s*/?>)*'.$marker.'(?:\s|<br\s*/?>)*</p>#i', '', $html) ?? $html;

        return str_replace(self::REMOVED, '', $html);
    }

    private static function mapTags(string $html, string $src, callable $map): string
    {
        return preg_replace_callback(
            self::IMG_TAG,
            static fn (array $match): string => self::source($match[0]) === $src ? $map($match[0]) : $match[0],
            $html,
        ) ?? $html;
    }

    private static function source(string $tag): ?string
    {
        if (! preg_match(self::SRC_ATTRIBUTE, $tag, $match)) {
            return null;
        }

        return html_entity_decode($match[3] !== '' ? $match[3] : ($match[4] ?? ''), ENT_QUOTES | ENT_HTML5);
    }
}
