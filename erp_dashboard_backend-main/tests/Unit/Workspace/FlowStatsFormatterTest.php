<?php

namespace Tests\Unit\Workspace;

use App\Services\Workspace\Reports\FlowStats\FlowStatsFormatter;
use Tests\TestCase;

/**
 * Тексты рассылки статистики Flow: исправления старого формата и деление длинных сообщений.
 */
class FlowStatsFormatterTest extends TestCase
{
    public function test_daily_messages_keep_old_titles_and_order(): void
    {
        $messages = (new FlowStatsFormatter)->daily([
            'developers' => [$this->dailyRow('Иван Петров', 3600)],
            'commercial_projects' => [$this->dailyRow('Shop <b>', 3600)],
            'internal_projects' => [$this->dailyRow('ALT ERP', 1800)],
            'internal_developers' => [$this->dailyRow('Иван Петров', 1800)],
        ]);

        $this->assertCount(3, $messages);
        $this->assertStringStartsWith("📊 Статистика по разработчикам на коммерческих проектах:\n<pre>Имя", $messages[0]);
        $this->assertStringContainsString('Имя                      День(ч) Неделя(ч) Месяц(ч)', $messages[0]);
        $this->assertStringContainsString('Иван Петров              1.0     1.0       1.0', $messages[0]);
        $this->assertStringStartsWith('📊 Статистика по коммерческим проектам:', $messages[1]);
        $this->assertStringContainsString('Shop &lt;b&gt;', $messages[1]);
        $this->assertStringStartsWith('📌 Статистика по внутренним проектам:', $messages[2]);
        $this->assertStringContainsString("</pre>\n\n📌 Статистика по разработчикам на внутренних проектах:\n<pre>", $messages[2]);
        $this->assertStringEndsWith('</pre>', $messages[2]);
    }

    public function test_daily_internal_message_is_skipped_when_empty(): void
    {
        $messages = (new FlowStatsFormatter)->daily([
            'developers' => [],
            'commercial_projects' => [],
            'internal_projects' => [],
            'internal_developers' => [],
        ]);

        $this->assertCount(2, $messages);
        $this->assertStringContainsString('Итого                    0.0     0.0       0.0', $messages[0]);
    }

    public function test_totals_are_summed_from_exact_seconds(): void
    {
        // Каждая строка округляется до 0.0, но вместе это 0.12 ч.
        $rows = array_map(fn (int $index): array => $this->dailyRow("Проект {$index}", 144), [1, 2, 3]);

        $messages = (new FlowStatsFormatter)->daily([
            'developers' => [],
            'commercial_projects' => $rows,
            'internal_projects' => [],
            'internal_developers' => [],
        ]);

        $this->assertStringContainsString('Проект 1 0.0', $messages[1]);
        $this->assertStringContainsString('Итого    0.1     0.1       0.1', $messages[1]);
    }

    public function test_long_names_are_cut_and_always_separated_from_numbers(): void
    {
        $messages = (new FlowStatsFormatter)->daily([
            'developers' => [$this->dailyRow('Константин Константинопольский', 3600)],
            'commercial_projects' => [
                $this->dailyRow('Che CRM - обслуживание', 3600),
                $this->dailyRow('Интернет-магазин строительных материалов', 3600),
            ],
            'internal_projects' => [],
            'internal_developers' => [],
        ]);

        // Колонка названий проектов: 24 знака и пробел.
        $this->assertStringContainsString("\nChe CRM - обслуживание   1.0", $messages[1]);
        $this->assertStringContainsString("\nИнтернет-магазин строит… 1.0", $messages[1]);
        $this->assertStringContainsString("\nКонстантин Константиноп… 1.0", $messages[0]);
    }

    public function test_weekly_deviations_have_signs_and_small_base_is_shown_as_new(): void
    {
        $messages = (new FlowStatsFormatter)->weekly([
            'developers' => [
                'rows' => [
                    ['name' => 'Иван Петров', 'current' => 64080, 'previous' => 360, 'average' => 22680.0],
                    ['name' => 'Анна Смирнова', 'current' => 36000, 'previous' => 36000, 'average' => 72000.0],
                ],
                'total' => ['current' => 100080, 'previous' => 36360, 'average' => 94680.0],
            ],
            'commercial_projects' => ['rows' => [], 'total' => ['current' => 0, 'previous' => 0, 'average' => 0.0]],
            'internal_projects' => ['rows' => [], 'total' => ['current' => 0, 'previous' => 0, 'average' => 0.0]],
            'gap' => ['from' => '10.09.2026', 'to' => '02.11.2026', 'previous' => null, 'average' => true, 'weeks' => null],
        ]);

        $this->assertCount(1, $messages);
        $this->assertStringContainsString(
            "\nИван Петров         17.8     0.1      +17.7     новый     6.3      +11.5     +182.5%",
            $messages[0],
        );
        $this->assertStringContainsString(
            "\nАнна Смирнова       10.0     10.0     0.0       0.0%      20.0     -10.0     -50.0%",
            $messages[0],
        );
        $this->assertStringContainsString(
            "\nИтого               27.8     10.1     +17.7     +175.2%   26.3     +1.5      +5.7%",
            $messages[0],
        );
        $this->assertStringEndsWith(
            "</pre>\nВ базе нет данных с 10.09.2026 по 02.11.2026. Средняя посчитана только по дням с данными.",
            $messages[0],
        );
    }

    public function test_top_shows_new_instead_of_huge_percent(): void
    {
        $messages = (new FlowStatsFormatter)->top([
            'rise' => [
                ['name' => 'LITHIUM', 'before' => 360, 'after' => 64080],
                ['name' => 'ивкино парк', 'before' => 53280, 'after' => 113760],
            ],
            'fall' => [['name' => 'vivabride', 'before' => 23760, 'after' => 3240]],
            'gap' => ['from' => '10.09.2026', 'to' => '02.11.2026', 'previous' => null, 'average' => false, 'weeks' => 'partial'],
        ]);

        $this->assertSame(
            "📈 Топ 3 проектов с наибольшим ростом активности за прошлую неделю:\n\n"
            ."LITHIUM: 0.1 =&gt; 17.8 (+17.7 ч) новый\n"
            ."ивкино парк: 14.8 =&gt; 31.6 (+16.8 ч) +113.5%\n\n"
            .'В базе нет данных с 10.09.2026 по 02.11.2026, а сравниваемые недели попали в этот пропуск частично, поэтому рост и падение искажены.',
            $messages[0],
        );
        $this->assertSame(
            "📉 Топ 3 проектов с наибольшим падением активности за прошлую неделю:\n\n"
            .'vivabride: 6.6 =&gt; 0.9 (-5.7 ч) -86.4%',
            $messages[1],
        );
    }

    public function test_long_table_is_split_by_rows_with_repeated_header(): void
    {
        $rows = array_map(fn (int $index): array => $this->dailyRow("Проект номер {$index}", 3600), range(1, 200));

        $messages = (new FlowStatsFormatter)->daily([
            'developers' => [],
            'commercial_projects' => $rows,
            'internal_projects' => [],
            'internal_developers' => [],
        ]);
        $projectMessages = array_slice($messages, 1);

        $this->assertGreaterThan(1, count($projectMessages));
        foreach ($projectMessages as $index => $message) {
            $this->assertLessThanOrEqual(FlowStatsFormatter::MESSAGE_LIMIT, mb_strlen($message));
            $this->assertStringEndsWith('</pre>', $message);
            if ($index > 0) {
                $this->assertStringStartsWith('<pre>Проект', $message);
            }
        }
        $this->assertSame(200, substr_count(implode("\n", $projectMessages), "\nПроект номер "));
        $this->assertStringContainsString('Итого', end($projectMessages));
    }

    /**
     * @return array{name: string, day: int, week: int, month: int}
     */
    private function dailyRow(string $name, int $seconds): array
    {
        return ['name' => $name, 'day' => $seconds, 'week' => $seconds, 'month' => $seconds];
    }
}
