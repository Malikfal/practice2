<?php

namespace App\Services\Workspace\Reports\ManagerReport;

use App\Enums\ManagerReportGranularity;
use App\Models\Company;
use App\Models\ManagerReportStat;
use App\Repositories\Workspace\Reports\ManagerReportRepository;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Строит отчет по менеджерам из накопленной статистики расчетных периодов.
 *
 * Суммы в копейках, часы в секундах, стоимость часа в копейках за час, доли в процентах.
 * Без доступа к финансам денежные поля возвращаются как null.
 */
class ManagerReportService
{
    private const MONTHS = [
        1 => 'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
    ];

    public function __construct(private readonly ManagerReportRepository $repository) {}

    /**
     * @param  array{from: string, to: string, granularity?: ?string, manager_ids?: array<int, string>}  $filters
     * @return array<string, mixed>
     */
    public function build(array $filters, string $companyId, bool $withFinance): array
    {
        $timezone = Company::query()->findOrFail($companyId)->payrollTimezone();
        $granularity = ManagerReportGranularity::tryFrom((string) ($filters['granularity'] ?? ''))
            ?? ManagerReportGranularity::WEEK;
        // Статистика хранится целыми периодами, поэтому границы расширяются до периодов, которые их содержат.
        $from = $this->periodStart(Carbon::parse($filters['from'], $timezone)->startOfDay());
        $to = $this->periodLastDay(Carbon::parse($filters['to'], $timezone)->startOfDay());
        $managerIds = collect($filters['manager_ids'] ?? [])->map(strval(...))->flip();

        $stats = $this->repository->stats($companyId, $from->toDateString(), $to->toDateString());
        // Имена берутся из сырых полей, как в фильтре: аксессор User::last_name достраивает фамилию из имени.
        $people = $this->repository->managers($companyId)->keyBy(static fn (object $manager): string => (string) $manager->id);
        $buckets = $this->buckets($granularity, $from, $to);
        $companySums = $this->sums($stats, deduplicate: true);
        $selected = $managerIds->isEmpty()
            ? $stats
            : $stats->filter(static fn (ManagerReportStat $stat): bool => $managerIds->has((string) $stat->manager_id));

        $managers = $selected
            ->groupBy(static fn (ManagerReportStat $stat): string => (string) $stat->manager_id)
            ->map(fn (Collection $rows, string $managerId): array => $this->managerRow(
                $rows,
                $people->get($managerId),
                $granularity,
                $buckets,
                $companySums,
                $withFinance,
            ))
            ->sortByDesc('supervised_seconds')
            ->values();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'granularity' => $granularity->value,
            'can_view_finance' => $withFinance,
            'collected_at' => $stats->max('updated_at')?->toIso8601String(),
            'buckets' => $buckets->values()->all(),
            'summary' => [
                'managers_count' => $selected->pluck('manager_id')->unique()->count(),
                ...$this->metrics($this->sums($selected, deduplicate: true), $withFinance, $companySums),
            ],
            // Компания целиком, без фильтра по менеджерам: строка "Компания" в графиках.
            'company' => [
                ...$this->metrics($companySums, $withFinance),
                'series' => $this->series($stats, $granularity, $buckets, $withFinance, deduplicate: true),
            ],
            'managers' => $managers->all(),
            'manager_options' => $people
                ->map(fn (object $manager): array => $this->person($manager))
                ->values()
                ->all(),
        ];
    }

    /**
     * Доли менеджера считаются от всей компании, доли его проектов - от самого менеджера.
     *
     * @param  Collection<int, ManagerReportStat>  $rows
     * @param  object{id: string, name: ?string, last_name: ?string, email: ?string}|null  $manager
     * @param  Collection<string, array<string, string>>  $buckets
     * @param  array<string, int>  $companySums
     * @return array<string, mixed>
     */
    private function managerRow(
        Collection $rows,
        ?object $manager,
        ManagerReportGranularity $granularity,
        Collection $buckets,
        array $companySums,
        bool $withFinance,
    ): array {
        $managerSums = $this->sums($rows);

        $projects = $rows
            ->filter(static fn (ManagerReportStat $stat): bool => $stat->project_id !== null)
            ->groupBy(static fn (ManagerReportStat $stat): string => (string) $stat->project_id)
            ->map(fn (Collection $projectStats): array => [
                'project' => [
                    'id' => (string) $projectStats->first()->project_id,
                    'name' => (string) ($projectStats->first()->project?->name ?? 'Удаленный проект'),
                    'is_internal' => (bool) ($projectStats->first()->project?->is_internal ?? false),
                ],
                // У проекта начисление менеджеру - его доля, распределенная по часам под контролем.
                ...$this->metrics(
                    [...$this->sums($projectStats), 'manager_cost' => (int) $projectStats->sum('manager_cost')],
                    $withFinance,
                    $managerSums,
                ),
            ])
            ->sortByDesc('supervised_seconds')
            ->values();

        return [
            'manager' => $this->person($manager, (string) $rows->first()->manager_id),
            ...$this->metrics($managerSums, $withFinance, $companySums),
            'series' => $this->series($rows, $granularity, $buckets, $withFinance),
            'projects' => $projects->all(),
        ];
    }

    /**
     * Показатели по точкам оси времени, включая пустые.
     *
     * @param  Collection<int, ManagerReportStat>  $rows
     * @param  Collection<string, array<string, string>>  $buckets
     * @return array<int, array<string, mixed>>
     */
    private function series(
        Collection $rows,
        ManagerReportGranularity $granularity,
        Collection $buckets,
        bool $withFinance,
        bool $deduplicate = false,
    ): array {
        $byBucket = $rows->groupBy(fn (ManagerReportStat $stat): string => $this->bucketKey($granularity, $stat));

        return $buckets
            ->map(fn (array $bucket, string $key): array => [
                'key' => $key,
                ...$this->metrics($this->sums($byBucket->get($key, collect()), $deduplicate), $withFinance),
            ])
            ->values()
            ->all();
    }

    /**
     * Суммы строк статистики. Начисление менеджеру берется из строк без проекта, а не из распределения.
     *
     * С дедупликацией (итог и компания) часы и расходы команды проекта с несколькими PM учитываются
     * один раз за период. Часы под контролем, собственное время и начисления менеджерам суммируются:
     * они у каждого менеджера свои.
     *
     * @param  Collection<int, ManagerReportStat>  $rows
     * @return array{projects_count: int, developer_seconds: int, team_seconds: int, own_seconds: int, supervised_seconds: int, developer_cost: int, team_cost: int, controlled_cost: int, manager_cost: int}
     */
    private function sums(Collection $rows, bool $deduplicate = false): array
    {
        $projectRows = $rows->filter(static fn (ManagerReportStat $stat): bool => $stat->project_id !== null);
        $shared = static fn (string $field): int => (int) $projectRows->sum($field);

        if ($deduplicate) {
            $groups = $projectRows->groupBy(
                static fn (ManagerReportStat $stat): string => $stat->period_from->toDateString().'|'.$stat->project_id,
            );
            $shared = static fn (string $field): int => (int) $groups->sum(
                static fn (Collection $group): int => (int) $group->max($field),
            );
        }

        return [
            'projects_count' => $projectRows->pluck('project_id')->unique()->count(),
            'developer_seconds' => $shared('developer_seconds'),
            'team_seconds' => $shared('team_seconds'),
            'own_seconds' => (int) $projectRows->sum('own_seconds'),
            'supervised_seconds' => (int) $projectRows->sum('supervised_seconds'),
            'developer_cost' => $shared('developer_cost'),
            'team_cost' => $shared('team_cost'),
            'controlled_cost' => (int) $projectRows->sum('controlled_cost'),
            'manager_cost' => (int) $rows->whereNull('project_id')->sum('manager_cost'),
        ];
    }

    /**
     * Показатели группы строк: менеджера, проекта, итога или точки графика.
     *
     * Общая стоимость часа разработки: начисления команде и менеджеру на все часы проектов, включая
     * собственное время менеджера. Стоимость часа разработчика: начисления разработчикам на их часы.
     *
     * @param  array<string, int>  $sums
     * @param  array<string, int>|null  $shareBase  Суммы, от которых считаются доли; без них долей нет.
     * @return array<string, mixed>
     */
    private function metrics(array $sums, bool $withFinance, ?array $shareBase = null): array
    {
        $totalSeconds = $sums['team_seconds'] + $sums['own_seconds'];
        $totalCost = $sums['team_cost'] + $sums['manager_cost'];

        $metrics = [
            'projects_count' => $sums['projects_count'],
            'developer_seconds' => $sums['developer_seconds'],
            'supervised_seconds' => $sums['supervised_seconds'],
            'total_seconds' => $totalSeconds,
            'manager_cost' => $withFinance ? $sums['manager_cost'] : null,
            'developer_cost' => $withFinance ? $sums['developer_cost'] : null,
            'total_cost' => $withFinance ? $totalCost : null,
            'supervised_hour_cost' => $withFinance ? $this->hourCost($sums['manager_cost'], $sums['supervised_seconds']) : null,
            'total_hour_cost' => $withFinance ? $this->hourCost($totalCost, $totalSeconds) : null,
            'developer_hour_cost' => $withFinance ? $this->hourCost($sums['developer_cost'], $sums['developer_seconds']) : null,
        ];

        if ($shareBase !== null) {
            $metrics['hours_share'] = $this->percent($sums['supervised_seconds'], $shareBase['supervised_seconds']);
            $metrics['money_share'] = $withFinance ? $this->percent($sums['controlled_cost'], $shareBase['controlled_cost']) : null;
        }

        return $metrics;
    }

    /**
     * Точки оси времени от начала до конца диапазона, включая пустые.
     *
     * @return Collection<string, array{key: string, from: string, to: string, label: string}>
     */
    private function buckets(ManagerReportGranularity $granularity, Carbon $from, Carbon $to): Collection
    {
        $buckets = collect();
        $cursor = $from->copy();

        while ($cursor->lte($to)) {
            [$start, $end] = match ($granularity) {
                ManagerReportGranularity::WEEK => [$cursor->copy()->startOfWeek(CarbonInterface::MONDAY), $cursor->copy()->endOfWeek(CarbonInterface::SUNDAY)],
                ManagerReportGranularity::MONTH => [$cursor->copy()->startOfMonth(), $cursor->copy()->endOfMonth()],
                ManagerReportGranularity::QUARTER => [$cursor->copy()->startOfQuarter(), $cursor->copy()->endOfQuarter()],
                ManagerReportGranularity::YEAR => [$cursor->copy()->startOfYear(), $cursor->copy()->endOfYear()],
            };
            $bucketFrom = $start->max($from)->copy()->startOfDay();
            $bucketTo = $end->min($to)->copy()->startOfDay();
            $key = $this->keyForDate($granularity, $start);
            $buckets->put($key, [
                'key' => $key,
                'from' => $bucketFrom->toDateString(),
                'to' => $bucketTo->toDateString(),
                'label' => $this->label($granularity, $start, $bucketFrom, $bucketTo),
            ]);
            $cursor = $end->copy()->addDay()->startOfDay();
        }

        return $buckets;
    }

    private function bucketKey(ManagerReportGranularity $granularity, ManagerReportStat $stat): string
    {
        return $granularity === ManagerReportGranularity::WEEK
            ? $this->keyForDate($granularity, $stat->week_start)
            : $this->keyForDate($granularity, $stat->period_from);
    }

    private function keyForDate(ManagerReportGranularity $granularity, CarbonInterface $date): string
    {
        return match ($granularity) {
            ManagerReportGranularity::WEEK => $date->copy()->startOfWeek(CarbonInterface::MONDAY)->toDateString(),
            ManagerReportGranularity::MONTH => $date->format('Y-m'),
            ManagerReportGranularity::QUARTER => $date->format('Y').'-Q'.$date->quarter,
            ManagerReportGranularity::YEAR => $date->format('Y'),
        };
    }

    private function label(ManagerReportGranularity $granularity, Carbon $start, Carbon $from, Carbon $to): string
    {
        return match ($granularity) {
            ManagerReportGranularity::WEEK => $from->format('d.m').' - '.$to->format('d.m'),
            ManagerReportGranularity::MONTH => self::MONTHS[$start->month].' '.$start->year,
            ManagerReportGranularity::QUARTER => $start->quarter.' кв. '.$start->year,
            ManagerReportGranularity::YEAR => (string) $start->year,
        };
    }

    /** Начало расчетного периода, в который попадает дата: понедельник или первое число месяца. */
    private function periodStart(Carbon $date): Carbon
    {
        return $date->copy()->startOfWeek(CarbonInterface::MONDAY)->max($date->copy()->startOfMonth());
    }

    /** Последний день расчетного периода, в который попадает дата: воскресенье или конец месяца. */
    private function periodLastDay(Carbon $date): Carbon
    {
        return $date->copy()->endOfWeek(CarbonInterface::SUNDAY)->min($date->copy()->endOfMonth())->startOfDay();
    }

    private function hourCost(int $amount, int $seconds): ?int
    {
        return $seconds > 0 ? (int) round($amount * 3600 / $seconds) : null;
    }

    private function percent(int $value, int $total): float
    {
        return $total > 0 ? round($value * 100 / $total, 2) : 0.0;
    }

    /** @return array{id: string, name: string, first_name: string, last_name: string, email: ?string} */
    private function person(?object $person, ?string $fallbackId = null): array
    {
        $firstName = trim((string) ($person?->name ?? ''));
        $lastName = trim((string) ($person?->last_name ?? ''));

        return [
            'id' => (string) ($person?->id ?? $fallbackId),
            'name' => trim($firstName.' '.$lastName) ?: (string) ($person?->email ?? 'Удаленный сотрудник'),
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $person?->email,
        ];
    }
}
