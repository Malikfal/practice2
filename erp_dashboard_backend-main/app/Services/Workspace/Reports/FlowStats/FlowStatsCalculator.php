<?php

namespace App\Services\Workspace\Reports\FlowStats;

use App\Models\Company;
use App\Repositories\Workspace\Reports\FlowStatsRepository;
use App\Support\CurrentDay;
use App\Support\CurrentWeek;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Throwable;

/**
 * Расчет статистики часов Flow для рассылки в Telegram.
 *
 * Периоды считаются в часовом поясе компании до момента отчета: текущие сутки, неделя с понедельника
 * и календарный месяц. Внутренний проект определяется флагом projects.is_internal.
 * «Средняя» неделя складывается из средних часов по дням недели с понедельника по день отчета.
 * Средние берутся за 90 дней до вчерашнего дня включительно, без дней из пропуска в данных
 * (services.flow_stats.data_gap_from и data_gap_to).
 *
 * @phpstan-type DailyRow array{name: string, day: int, week: int, month: int}
 * @phpstan-type WeeklyRow array{name: string, current: int, previous: int, average: float}
 * @phpstan-type WeeklySection array{rows: list<WeeklyRow>, total: array{current: int, previous: int, average: float}}
 * @phpstan-type TopRow array{name: string, before: int, after: int}
 * @phpstan-type Gap array{from: string, to: string, previous: 'full'|'partial'|null, average: bool, weeks: 'full'|'partial'|null}
 */
class FlowStatsCalculator
{
    public const AVERAGE_DAYS = 90;

    public const TOP_SIZE = 3;

    public function __construct(private readonly FlowStatsRepository $repository) {}

    /**
     * @return array{developers: list<DailyRow>, commercial_projects: list<DailyRow>, internal_projects: list<DailyRow>, internal_developers: list<DailyRow>}
     */
    public function daily(Company $company, CarbonInterface $at): array
    {
        $now = $this->moment($company, $at);
        $periods = [
            'day' => CarbonImmutable::instance(CurrentDay::bounds($company->id, $now)[0]),
            'week' => CarbonImmutable::instance(CurrentWeek::bounds($company->id, $now)[0]),
            'month' => $now->startOfMonth(),
        ];
        $excluded = $this->excludedUserIds($company);
        $groups = ['developers' => [], 'commercial_projects' => [], 'internal_projects' => [], 'internal_developers' => []];
        $empty = ['day' => 0, 'week' => 0, 'month' => 0];

        foreach ($periods as $period => $from) {
            foreach ($this->repository->seconds($company->id, $from, $now, $excluded) as $row) {
                $internal = (bool) $row->is_internal;
                $seconds = (int) $row->seconds;
                $user = $internal ? 'internal_developers' : 'developers';
                $project = $internal ? 'internal_projects' : 'commercial_projects';

                $groups[$user][(string) $row->user_id] ??= ['name' => $this->userName($row)] + $empty;
                $groups[$user][(string) $row->user_id][$period] += $seconds;
                $groups[$project][(string) $row->project_id] ??= ['name' => (string) $row->project_name] + $empty;
                $groups[$project][(string) $row->project_id][$period] += $seconds;
            }
        }

        return array_map(static function (array $rows): array {
            usort($rows, static fn (array $a, array $b): int => [$b['day'], $b['week'], $b['month'], mb_strtolower($a['name'])]
                <=> [$a['day'], $a['week'], $a['month'], mb_strtolower($b['name'])]);

            return $rows;
        }, $groups);
    }

    /**
     * Текущая неделя до момента отчета против прошлой недели с понедельника по тот же день недели и против средней.
     * Разработчики считаются только по коммерческим проектам.
     *
     * @return array{developers: WeeklySection, commercial_projects: WeeklySection, internal_projects: WeeklySection, gap: Gap|null}
     */
    public function weekly(Company $company, CarbonInterface $at): array
    {
        $now = $this->moment($company, $at);
        [$dayStart, $dayEnd] = array_map(CarbonImmutable::instance(...), CurrentDay::bounds($company->id, $now));
        $weekStart = CarbonImmutable::instance(CurrentWeek::bounds($company->id, $now)[0]);
        $periods = [
            'current' => [$weekStart, $now],
            'previous' => [$weekStart->subWeek(), $dayEnd->subWeek()],
        ];
        $excluded = $this->excludedUserIds($company);
        $sections = ['developers' => [], 'commercial_projects' => [], 'internal_projects' => []];

        foreach ($periods as $period => [$from, $to]) {
            foreach ($this->repository->seconds($company->id, $from, $to, $excluded) as $row) {
                $seconds = (int) $row->seconds;
                foreach ($this->weeklyEntities($row) as $section => $id) {
                    $name = $section === 'developers' ? $this->userName($row) : (string) $row->project_name;
                    $sections[$section][$id] ??= ['name' => $name, 'current' => 0, 'previous' => 0, 'average' => 0.0];
                    $sections[$section][$id][$period] += $seconds;
                }
            }
        }

        $gap = $this->gap($company);
        $days = $this->averageDays($dayStart, $gap);
        $averages = $this->averages($company, $days, $excluded, $now->dayOfWeekIso);

        $result = [];
        foreach ($sections as $section => $rows) {
            foreach ($rows as $id => $row) {
                $rows[$id]['average'] = $averages['entities'][$section][$id] ?? 0.0;
            }
            $rows = array_values($rows);
            usort($rows, static fn (array $a, array $b): int => [$b['current'] - $b['previous'], mb_strtolower($a['name'])]
                <=> [$a['current'] - $a['previous'], mb_strtolower($b['name'])]);

            $result[$section] = [
                'rows' => $rows,
                'total' => [
                    'current' => array_sum(array_column($rows, 'current')),
                    'previous' => array_sum(array_column($rows, 'previous')),
                    'average' => $averages['totals'][$section] ?? 0.0,
                ],
            ];
        }

        $previous = $gap === null ? null : $this->overlap($gap, ...$periods['previous']);
        $skippedDays = self::AVERAGE_DAYS - count($days);
        $result['gap'] = $gap !== null && ($previous !== null || $skippedDays > 0)
            ? $this->gapInfo($gap, previous: $previous, average: $skippedDays > 0)
            : null;

        return $result;
    }

    /**
     * Топ проектов по росту и падению часов: прошлая полная неделя против позапрошлой.
     *
     * @return array{rise: list<TopRow>, fall: list<TopRow>, gap: Gap|null}
     */
    public function top(Company $company, CarbonInterface $at): array
    {
        $now = $this->moment($company, $at);
        $weekStart = CarbonImmutable::instance(CurrentWeek::bounds($company->id, $now)[0]);
        $periods = [
            'after' => [$weekStart->subWeek(), $weekStart],
            'before' => [$weekStart->subWeeks(2), $weekStart->subWeek()],
        ];
        $excluded = $this->excludedUserIds($company);
        $projects = [];

        foreach ($periods as $period => [$from, $to]) {
            foreach ($this->repository->seconds($company->id, $from, $to, $excluded) as $row) {
                $projects[(string) $row->project_id] ??= ['name' => (string) $row->project_name, 'before' => 0, 'after' => 0];
                $projects[(string) $row->project_id][$period] += (int) $row->seconds;
            }
        }

        $rise = array_values(array_filter($projects, static fn (array $row): bool => $row['after'] > $row['before']));
        $fall = array_values(array_filter($projects, static fn (array $row): bool => $row['after'] < $row['before']));
        usort($rise, static fn (array $a, array $b): int => [$b['after'] - $b['before'], $a['name']] <=> [$a['after'] - $a['before'], $b['name']]);
        usort($fall, static fn (array $a, array $b): int => [$a['after'] - $a['before'], $a['name']] <=> [$b['after'] - $b['before'], $b['name']]);

        $gap = $this->gap($company);
        $weeks = $gap === null ? null : $this->overlap($gap, $periods['before'][0], $periods['after'][1]);

        return [
            'rise' => array_slice($rise, 0, self::TOP_SIZE),
            'fall' => array_slice($fall, 0, self::TOP_SIZE),
            'gap' => $weeks !== null ? $this->gapInfo($gap, weeks: $weeks) : null,
        ];
    }

    private function moment(Company $company, CarbonInterface $at): CarbonImmutable
    {
        return CarbonImmutable::instance($at)->setTimezone($company->payrollTimezone());
    }

    /**
     * @return array<string, string> раздел недельного отчета => id сотрудника или проекта
     */
    private function weeklyEntities(object $row): array
    {
        return (bool) $row->is_internal
            ? ['internal_projects' => (string) $row->project_id]
            : ['developers' => (string) $row->user_id, 'commercial_projects' => (string) $row->project_id];
    }

    /**
     * Дни для средней: 90 дней до вчерашнего включительно, кроме дней из пропуска в данных.
     *
     * @param  array{start: CarbonImmutable, end: CarbonImmutable}|null  $gap
     * @return list<array{date: string, start: int, end: int}>
     */
    private function averageDays(CarbonImmutable $todayStart, ?array $gap): array
    {
        $days = [];
        for ($offset = 1; $offset <= self::AVERAGE_DAYS; $offset++) {
            $day = $todayStart->subDays($offset);
            if ($gap !== null && $day >= $gap['start'] && $day < $gap['end']) {
                continue;
            }

            $days[] = ['date' => $day->toDateString(), 'start' => $day->timestamp, 'end' => $day->addDay()->timestamp];
        }

        return $days;
    }

    /**
     * Средние недели до дня $weekday включительно: по каждому дню недели среднее за дни с данными, затем сумма.
     *
     * @param  list<array{date: string, start: int, end: int}>  $days
     * @param  list<string>  $excluded
     * @return array{entities: array<string, array<string, float>>, totals: array<string, float>}
     */
    private function averages(Company $company, array $days, array $excluded, int $weekday): array
    {
        $weekdays = [];
        $dayCounts = array_fill(1, 7, 0);
        foreach ($days as $day) {
            $weekdays[$day['date']] = CarbonImmutable::parse($day['date'])->dayOfWeekIso;
            $dayCounts[$weekdays[$day['date']]]++;
        }

        $entities = [];
        $totals = [];
        foreach ($this->repository->secondsByDay($company->id, $days, $excluded) as $row) {
            $dayOfWeek = $weekdays[(string) $row->day_date] ?? null;
            if ($dayOfWeek === null || $dayOfWeek > $weekday) {
                continue;
            }

            $share = (int) $row->seconds / $dayCounts[$dayOfWeek];
            foreach ($this->weeklyEntities($row) as $section => $id) {
                $entities[$section][$id] = ($entities[$section][$id] ?? 0.0) + $share;
                $totals[$section] = ($totals[$section] ?? 0.0) + $share;
            }
        }

        return ['entities' => $entities, 'totals' => $totals];
    }

    /**
     * Пропуск в данных из настроек: даты включительно в часовом поясе компании.
     *
     * @return array{start: CarbonImmutable, end: CarbonImmutable}|null
     */
    private function gap(Company $company): ?array
    {
        $from = (string) config('services.flow_stats.data_gap_from', '');
        $to = (string) config('services.flow_stats.data_gap_to', '');
        if ($from === '' || $to === '') {
            return null;
        }

        try {
            $start = CarbonImmutable::parse($from, $company->payrollTimezone())->startOfDay();
            $end = CarbonImmutable::parse($to, $company->payrollTimezone())->startOfDay()->addDay();
        } catch (Throwable) {
            return null;
        }

        return $start < $end ? ['start' => $start, 'end' => $end] : null;
    }

    /**
     * @param  array{start: CarbonImmutable, end: CarbonImmutable}  $gap
     * @return 'full'|'partial'|null
     */
    private function overlap(array $gap, CarbonImmutable $from, CarbonImmutable $to): ?string
    {
        if ($from >= $gap['end'] || $to <= $gap['start']) {
            return null;
        }

        return $from >= $gap['start'] && $to <= $gap['end'] ? 'full' : 'partial';
    }

    /**
     * @param  array{start: CarbonImmutable, end: CarbonImmutable}  $gap
     * @param  'full'|'partial'|null  $previous
     * @param  'full'|'partial'|null  $weeks
     * @return Gap
     */
    private function gapInfo(array $gap, ?string $previous = null, bool $average = false, ?string $weeks = null): array
    {
        return [
            'from' => $gap['start']->format('d.m.Y'),
            'to' => $gap['end']->subDay()->format('d.m.Y'),
            'previous' => $previous,
            'average' => $average,
            'weeks' => $weeks,
        ];
    }

    /**
     * @return list<string>
     */
    private function excludedUserIds(Company $company): array
    {
        $emails = array_values(array_filter(array_map(
            trim(...),
            explode(',', (string) config('services.flow_stats.excluded_emails', '')),
        )));

        return $this->repository->userIdsByEmails($company->id, $emails);
    }

    private function userName(object $row): string
    {
        $name = trim($row->user_first_name.' '.$row->user_last_name);

        return $name !== '' ? $name : (string) ($row->user_email ?: $row->user_id);
    }
}
