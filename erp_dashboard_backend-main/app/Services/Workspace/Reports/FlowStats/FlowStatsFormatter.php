<?php

namespace App\Services\Workspace\Reports\FlowStats;

/**
 * Тексты рассылки статистики Flow для Telegram с parse_mode HTML.
 *
 * Формат повторяет старый скрипт бота @altservicetool_bot: те же заголовки, колонки и порядок сообщений.
 * Отличия от него: длинные названия обрезаются и всегда отделены от цифр пробелом, у ненулевых отклонений
 * всегда стоит знак, при базе меньше часа вместо процента роста пишется «новый», а итоги считаются
 * из точных секунд, а не из округленных строк.
 *
 * @phpstan-import-type DailyRow from FlowStatsCalculator
 * @phpstan-import-type WeeklySection from FlowStatsCalculator
 * @phpstan-import-type TopRow from FlowStatsCalculator
 * @phpstan-import-type Gap from FlowStatsCalculator
 *
 * @phpstan-type Block array{text: string}|array{head: list<string>, rows: list<string>, foot: list<string>}
 */
class FlowStatsFormatter
{
    /** Предел длины сообщения Telegram. */
    public const MESSAGE_LIMIT = 4096;

    /** Самое длинное название проекта в таблице, длиннее обрезается. */
    private const PROJECT_NAME_LIMIT = 24;

    private const DAILY_USER_WIDTH = 25;

    private const WEEKLY_USER_WIDTH = 20;

    private const DAILY_COLUMNS = [['День(ч)', 8], ['Неделя(ч)', 10], ['Месяц(ч)', 9]];

    private const WEEKLY_COLUMNS = [
        ['Тек.нед', 9], ['Пред.нед', 9], ['Откл.(ч)', 10], ['Откл.(%)', 10],
        ['Средняя', 9], ['Откл.(ч)', 10], ['Откл.(%)', 10],
    ];

    /** Если база сравнения меньше часа, процент роста не показывается. */
    private const NEW_BASE_SECONDS = 3600;

    /**
     * Три сообщения: разработчики на коммерческих проектах, коммерческие проекты,
     * внутренние проекты вместе с разработчиками на них. Третье не отправляется, если оно пустое.
     *
     * @param  array{developers: list<DailyRow>, commercial_projects: list<DailyRow>, internal_projects: list<DailyRow>, internal_developers: list<DailyRow>}  $report
     * @return list<string>
     */
    public function daily(array $report): array
    {
        $messages = [
            ...$this->render([
                ['text' => "📊 Статистика по разработчикам на коммерческих проектах:\n"],
                $this->dailyTable('Имя', $report['developers'], self::DAILY_USER_WIDTH),
            ]),
            ...$this->render([
                ['text' => "📊 Статистика по коммерческим проектам:\n"],
                $this->dailyTable('Проект', $report['commercial_projects']),
            ]),
        ];

        $internal = [];
        if ($report['internal_projects'] !== []) {
            $internal[] = ['text' => "📌 Статистика по внутренним проектам:\n"];
            $internal[] = $this->dailyTable('Проект', $report['internal_projects']);
        }
        if ($report['internal_developers'] !== []) {
            $internal[] = ['text' => ($internal === [] ? '' : "\n\n")."📌 Статистика по разработчикам на внутренних проектах:\n"];
            $internal[] = $this->dailyTable('Имя', $report['internal_developers'], self::DAILY_USER_WIDTH);
        }

        return $internal === [] ? $messages : [...$messages, ...$this->render($internal)];
    }

    /**
     * Недельные отчеты по разработчикам, коммерческим и внутренним проектам.
     * Строка о пропуске в данных стоит в первом сообщении. Пустые отчеты по проектам не отправляются.
     *
     * @param  array{developers: WeeklySection, commercial_projects: WeeklySection, internal_projects: WeeklySection, gap: Gap|null}  $report
     * @return list<string>
     */
    public function weekly(array $report): array
    {
        $developers = [
            ['text' => "📊 Недельный отчёт по разработчикам с показателями средней недели за 3 месяца:\n\n"],
            $this->weeklyTable('Имя', $report['developers'], self::WEEKLY_USER_WIDTH),
        ];
        if ($report['gap'] !== null) {
            $developers[] = ['text' => "\n".$this->escape($this->weeklyGapNote($report['gap']))];
        }

        $messages = $this->render($developers);
        foreach (['commercial_projects' => 'коммерческие проекты', 'internal_projects' => 'внутренние проекты'] as $section => $title) {
            if ($report[$section]['rows'] === []) {
                continue;
            }

            $messages = [...$messages, ...$this->render([
                ['text' => "📊 Недельный отчёт {$title}:\n\n"],
                $this->weeklyTable('Проект', $report[$section]),
            ])];
        }

        return $messages;
    }

    /**
     * Два сообщения: топ проектов по росту часов и по падению.
     *
     * @param  array{rise: list<TopRow>, fall: list<TopRow>, gap: Gap|null}  $report
     * @return list<string>
     */
    public function top(array $report): array
    {
        $rise = "📈 Топ 3 проектов с наибольшим ростом активности за прошлую неделю:\n\n".$this->topLines($report['rise']);
        if ($report['gap'] !== null) {
            $rise .= "\n\n".$this->escape($this->topGapNote($report['gap']));
        }

        return [
            ...$this->render([['text' => $rise]]),
            ...$this->render([['text' => "📉 Топ 3 проектов с наибольшим падением активности за прошлую неделю:\n\n".$this->topLines($report['fall'])]]),
        ];
    }

    /**
     * @param  list<DailyRow>  $rows
     * @return Block
     */
    private function dailyTable(string $nameTitle, array $rows, ?int $nameWidth = null): array
    {
        $values = [];
        $total = ['day' => 0, 'week' => 0, 'month' => 0];
        foreach ($rows as $row) {
            $values[] = [$row['name'], $this->hours($row['day']), $this->hours($row['week']), $this->hours($row['month'])];
            foreach ($total as $period => $seconds) {
                $total[$period] = $seconds + $row[$period];
            }
        }

        return $this->table(
            $nameTitle,
            self::DAILY_COLUMNS,
            $values,
            [$this->hours($total['day']), $this->hours($total['week']), $this->hours($total['month'])],
            $nameWidth,
        );
    }

    /**
     * @param  WeeklySection  $section
     * @return Block
     */
    private function weeklyTable(string $nameTitle, array $section, ?int $nameWidth = null): array
    {
        $values = array_map(fn (array $row): array => [$row['name'], ...$this->weeklyValues($row)], $section['rows']);

        return $this->table($nameTitle, self::WEEKLY_COLUMNS, $values, $this->weeklyValues($section['total']), $nameWidth);
    }

    /**
     * @param  array{current: int, previous: int, average: float}  $row
     * @return list<string>
     */
    private function weeklyValues(array $row): array
    {
        $fromPrevious = $row['current'] - $row['previous'];
        $fromAverage = $row['current'] - $row['average'];

        return [
            $this->hours($row['current']),
            $this->hours($row['previous']),
            $this->signedHours($fromPrevious),
            $this->percent($fromPrevious, $row['previous']),
            $this->hours($row['average']),
            $this->signedHours($fromAverage),
            $this->percent($fromAverage, $row['average']),
        ];
    }

    /**
     * Таблица для блока <pre>: шапка, строки и итог. Первая колонка — название, остальные — числа.
     * Ширину колонки названий проектов задают сами названия, но не больше PROJECT_NAME_LIMIT знаков.
     *
     * @param  list<array{0: string, 1: int}>  $columns
     * @param  list<list<string>>  $rows
     * @param  list<string>  $total
     * @return Block
     */
    private function table(string $nameTitle, array $columns, array $rows, array $total, ?int $nameWidth): array
    {
        if ($nameWidth === null) {
            $lengths = array_map(static fn (array $row): int => mb_strlen($row[0]), $rows);
            $nameWidth = min(max([mb_strlen($nameTitle), mb_strlen('Итого'), ...$lengths]), self::PROJECT_NAME_LIMIT) + 1;
        }

        $line = function (array $cells) use ($columns, $nameWidth): string {
            $text = $this->nameCell((string) array_shift($cells), $nameWidth);
            foreach ($columns as $index => [, $width]) {
                $text .= $this->valueCell((string) ($cells[$index] ?? ''), $width);
            }

            return rtrim($text);
        };
        $separator = str_repeat('-', $nameWidth + array_sum(array_column($columns, 1)));

        return [
            'head' => [$line([$nameTitle, ...array_column($columns, 0)]), $separator],
            'rows' => array_map($line, $rows),
            'foot' => [$separator, $line(['Итого', ...$total])],
        ];
    }

    /**
     * @param  list<TopRow>  $rows
     */
    private function topLines(array $rows): string
    {
        if ($rows === []) {
            return 'Таких проектов нет.';
        }

        return implode("\n", array_map(function (array $row): string {
            $diff = $row['after'] - $row['before'];

            return $this->escape(sprintf(
                '%s: %s => %s (%s ч) %s',
                $row['name'],
                $this->hours($row['before']),
                $this->hours($row['after']),
                $this->signedHours($diff),
                $this->percent($diff, $row['before']),
            ));
        }, $rows));
    }

    /**
     * @param  Gap  $gap
     */
    private function weeklyGapNote(array $gap): string
    {
        $note = "В базе нет данных с {$gap['from']} по {$gap['to']}.";
        $note .= match ($gap['previous']) {
            'full' => ' Прошлая неделя целиком попала в этот пропуск, поэтому сравнение с ней не показательно.',
            'partial' => ' Часть прошлой недели попала в этот пропуск, поэтому её часы занижены.',
            default => '',
        };

        return $note.($gap['average'] ? ' Средняя посчитана только по дням с данными.' : '');
    }

    /**
     * @param  Gap  $gap
     */
    private function topGapNote(array $gap): string
    {
        return "В базе нет данных с {$gap['from']} по {$gap['to']}, а сравниваемые недели попали в этот пропуск"
            .($gap['weeks'] === 'full' ? '' : ' частично').', поэтому рост и падение искажены.';
    }

    /**
     * Собирает сообщения из блоков текста и таблиц. Если сообщение длиннее предела Telegram,
     * таблица делится по строкам, а шапка таблицы повторяется в начале следующего сообщения.
     *
     * @param  list<Block>  $blocks
     * @return list<string>
     */
    private function render(array $blocks): array
    {
        $messages = [];
        $current = '';
        $fits = static fn (string $text): bool => mb_strlen($text) <= self::MESSAGE_LIMIT;

        foreach ($blocks as $block) {
            if (isset($block['text'])) {
                if (! $fits($current.$block['text']) && trim($current) !== '') {
                    $messages[] = rtrim($current);
                    $current = ltrim($block['text']);
                } else {
                    $current .= $block['text'];
                }

                continue;
            }

            $open = '<pre>'.implode("\n", array_map($this->escape(...), $block['head']));
            $current .= $open;
            $lines = 0;
            foreach ([...$block['rows'], ...$block['foot']] as $row) {
                $line = "\n".$this->escape($row);
                if (! $fits($current.$line.'</pre>') && $lines > 0) {
                    $messages[] = $current.'</pre>';
                    $current = $open;
                    $lines = 0;
                }
                $current .= $line;
                $lines++;
            }
            $current .= '</pre>';
        }

        if (trim($current) !== '') {
            $messages[] = rtrim($current);
        }

        return $messages;
    }

    private function nameCell(string $name, int $width): string
    {
        if (mb_strlen($name) > $width - 1) {
            $name = rtrim(mb_substr($name, 0, $width - 2)).'…';
        }

        return mb_str_pad($name, $width);
    }

    private function valueCell(string $value, int $width): string
    {
        return mb_str_pad($value, max($width, mb_strlen($value) + 1));
    }

    private function hours(int|float $seconds): string
    {
        $hours = number_format($seconds / 3600, 1, '.', '');

        return $hours === '-0.0' ? '0.0' : $hours;
    }

    private function signedHours(int|float $seconds): string
    {
        $hours = $this->hours($seconds);

        return $seconds > 0 && $hours !== '0.0' ? '+'.$hours : $hours;
    }

    private function percent(int|float $delta, int|float $base): string
    {
        if ($delta > 0 && $base < self::NEW_BASE_SECONDS) {
            return 'новый';
        }
        if ($base <= 0) {
            return '0.0%';
        }

        $percent = number_format($delta / $base * 100, 1, '.', '');
        if ($percent === '-0.0') {
            $percent = '0.0';
        }

        return ($delta > 0 && $percent !== '0.0' ? '+' : '').$percent.'%';
    }

    private function escape(string $text): string
    {
        return htmlspecialchars($text, ENT_NOQUOTES);
    }
}
