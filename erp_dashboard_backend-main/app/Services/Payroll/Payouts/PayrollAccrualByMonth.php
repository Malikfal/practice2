<?php

namespace App\Services\Payroll\Payouts;

use App\Enums\FinanceSource;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Сворачивает начисления сотрудников по месяцам и выделяет часть за 1-15 число для аванса.
 *
 * Начисления закрытой недели записаны одной датой - воскресеньем. Если 15-е число выпало на
 * середину недели, после закрытия ее сумма уходит на дату позже 15-го. Чтобы аванс не менялся
 * от того, закрыта неделя или нет, такая неделя делится по дням: в аванс идет доля дней по 15-е.
 */
final class PayrollAccrualByMonth
{
    public const PART_PERIOD = 'period';

    public const PART_OPERATION = 'operation';

    /**
     * @param  iterable<object>  $rows  Строки с полями employee_id, paid_on (ГГГГ-ММ-ДД), source, amount
     * @return array<string, array<string, array{accrued:int, first_half:int}>> сотрудник => месяц => суммы
     */
    public static function fromRows(iterable $rows): array
    {
        $result = [];

        foreach (self::parts($rows) as $employeeId => $months) {
            foreach ($months as $month => $parts) {
                $result[$employeeId][$month] = [
                    'accrued' => array_sum(array_column($parts, 'amount')),
                    'first_half' => array_sum(array_column($parts, 'first_half')),
                ];
            }
        }

        return $result;
    }

    /**
     * Раскладывает начисления месяца на части, из которых складываются "начислено" и аванс.
     *
     * Расчет ФОТ сворачивается в расчетные периоды: неделя или ее часть до границы месяца.
     * Остальные расходы с сотрудником (ручные операции, импорт) идут отдельными строками
     * по дате и статье.
     *
     * @param  iterable<object>  $rows  Строки с полями employee_id, paid_on, source, amount и необязательными article_id, article_name
     * @return array<string, array<string, list<array<string, mixed>>>> сотрудник => месяц => части
     */
    public static function parts(iterable $rows): array
    {
        $parts = [];
        $weeks = [];

        foreach ($rows as $row) {
            $employeeId = (string) $row->employee_id;
            $date = substr((string) $row->paid_on, 0, 10);
            $month = substr($date, 0, 7);
            $amount = (int) $row->amount;
            $source = (string) $row->source;
            $byDate = (int) substr($date, 8, 2) <= 15 ? $amount : 0;

            if (! in_array($source, [FinanceSource::PAYROLL_DAILY->value, FinanceSource::PAYROLL_RECALCULATION->value], true)) {
                $articleId = isset($row->article_id) ? (string) $row->article_id : null;
                $key = $date.':'.$source.':'.($articleId ?? '');
                $parts[$employeeId][$month][$key] ??= [
                    'type' => self::PART_OPERATION,
                    'date' => $date,
                    'source' => $source !== '' ? $source : null,
                    'article' => $row->article_name ?? null,
                    'amount' => 0,
                    'first_half' => 0,
                ];
                $parts[$employeeId][$month][$key]['amount'] += $amount;
                $parts[$employeeId][$month][$key]['first_half'] += $byDate;

                continue;
            }

            [$from, $to] = self::period($date);
            $parts[$employeeId][$month][$from] ??= [
                'type' => self::PART_PERIOD,
                'from' => $from,
                'to' => $to,
                'amount' => 0,
                'first_half' => 0,
                'is_closed' => false,
                'split_days' => null,
                'split_amount' => 0,
            ];
            $part = &$parts[$employeeId][$month][$from];
            $part['amount'] += $amount;
            $part['first_half'] += $byDate;

            if ($source === FinanceSource::PAYROLL_RECALCULATION->value) {
                $part['is_closed'] = true;
                $weeks[$month] ??= self::weekWithFifteenth($month);

                if ($weeks[$month] !== null && $date === $weeks[$month]['end']) {
                    $part['split_days'] = $weeks[$month]['days'];
                    $part['split_amount'] += $amount;
                }
            }

            unset($part);
        }

        foreach ($parts as $employeeId => $months) {
            foreach ($months as $month => $monthParts) {
                foreach ($monthParts as $key => $part) {
                    if ($part['type'] !== self::PART_PERIOD) {
                        continue;
                    }

                    if ($part['split_days'] !== null) {
                        $monthParts[$key]['first_half'] += (int) round($part['split_amount'] * $part['split_days'] / 7);
                    }

                    unset($monthParts[$key]['split_amount']);
                }

                // Сначала расчетные периоды по порядку, затем отдельные операции по дате.
                usort($monthParts, static fn (array $a, array $b): int => [$a['type'] !== self::PART_PERIOD, $a['from'] ?? $a['date']]
                    <=> [$b['type'] !== self::PART_PERIOD, $b['from'] ?? $b['date']]);
                $parts[$employeeId][$month] = $monthParts;
            }
        }

        return $parts;
    }

    /**
     * Возвращает расчетный период даты: неделю с понедельника по воскресенье, обрезанную границами месяца.
     *
     * @return array{0:string, 1:string}
     */
    private static function period(string $date): array
    {
        $day = Carbon::createFromFormat('!Y-m-d', $date, 'UTC');
        $monday = $day->copy()->startOfWeek(CarbonInterface::MONDAY);
        $sunday = $monday->copy()->addDays(6);

        return [
            max($monday->toDateString(), $day->copy()->startOfMonth()->toDateString()),
            min($sunday->toDateString(), $day->copy()->endOfMonth()->toDateString()),
        ];
    }

    /**
     * Возвращает воскресенье недели, в которую попало 15-е число, и количество ее дней по 15-е.
     *
     * @return array{end:string, days:int}|null null, если 15-е - воскресенье и делить нечего
     */
    private static function weekWithFifteenth(string $month): ?array
    {
        $fifteenth = Carbon::createFromFormat('!Y-m-d', $month.'-15', 'UTC');
        if ($fifteenth->isSunday()) {
            return null;
        }

        $monday = $fifteenth->copy()->startOfWeek(CarbonInterface::MONDAY);

        return [
            'end' => $monday->copy()->addDays(6)->toDateString(),
            'days' => 15 - (int) $monday->format('j') + 1,
        ];
    }
}
