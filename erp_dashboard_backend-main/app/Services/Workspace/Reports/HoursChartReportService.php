<?php

namespace App\Services\Workspace\Reports;

use App\Models\User;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Графический отчёт по часам: выработка за период одной суммой по дням, неделям или месяцам.
 *
 * Время и фильтры те же, что в отчете по времени с группировкой по дням, плюс фильтр по клиентам.
 * В ряд попадают все периоды диапазона, включая пустые; неделя начинается с понедельника,
 * границы считаются в часовом поясе компании. Крайние неделя и месяц обрезаются по выбранному периоду.
 *
 * @phpstan-type HoursChartRow array{key: string, from: string, to: string, partial: bool, seconds: int}
 */
class HoursChartReportService
{
    public const GROUP_BY_DAY = 'day';

    public const GROUP_BY_WEEK = 'week';

    public const GROUP_BY_MONTH = 'month';

    public const GROUPS = [self::GROUP_BY_DAY, self::GROUP_BY_WEEK, self::GROUP_BY_MONTH];

    public function __construct(
        private readonly TimeReportService $timeReports,
        private readonly TimeReportRepository $reports,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function build(array $data, string $companyId, ?User $actor = null): array
    {
        $timezone = $this->reports->timezoneForCompany($companyId);
        $scope = $this->timeReports->scope($data, $timezone, $actor);
        $groupBy = (string) ($data['group_by'] ?? self::GROUP_BY_DAY);
        $clientIds = $this->ids($data['client_ids'] ?? []);

        /** @var Collection<int, object> $days */
        $days = collect();
        if ($scope['has_available_projects']) {
            $days = $this->reports->own(
                $companyId,
                $scope['from'],
                $scope['range_to'],
                'day',
                $scope['project_ids'],
                $scope['task_ids'],
                $scope['user_ids'],
                timezone: $timezone,
                projectKinds: $scope['project_kinds'],
                managerIds: $scope['manager_ids'],
                allowedProjectIds: $scope['allowed_project_ids'],
                clientIds: $clientIds,
            );
        }

        /** @var array<string, int> $secondsByDate */
        $secondsByDate = [];
        foreach ($days as $day) {
            $secondsByDate[(string) $day->date] = (int) $day->duration_seconds;
        }

        $rows = $this->rows(
            CarbonImmutable::parse($scope['from']->toDateString()),
            CarbonImmutable::parse($scope['to']->toDateString()),
            $groupBy,
            $secondsByDate,
        );

        return [
            ...$this->timeReports->filters($scope),
            'from' => $scope['from']->toDateString(),
            'to' => $scope['to']->toDateString(),
            'client_ids' => $clientIds,
            'group_by' => $groupBy,
            'rows' => $rows,
            'total_seconds' => array_sum(array_column($rows, 'seconds')),
        ];
    }

    /**
     * @param  array<string, int>  $secondsByDate
     * @return list<HoursChartRow>
     */
    private function rows(CarbonImmutable $first, CarbonImmutable $last, string $groupBy, array $secondsByDate): array
    {
        /** @var array<string, HoursChartRow> $rows */
        $rows = [];

        for ($date = $first; $date->lte($last); $date = $date->addDay()) {
            [$start, $end] = $this->bucket($date, $groupBy);
            $key = $start->toDateString();

            $rows[$key] ??= [
                'key' => $key,
                'from' => $date->toDateString(),
                'to' => $date->toDateString(),
                'partial' => $start->lt($first) || $end->gt($last),
                'seconds' => 0,
            ];
            $rows[$key]['to'] = $date->toDateString();
            $rows[$key]['seconds'] += $secondsByDate[$date->toDateString()] ?? 0;
        }

        return array_values($rows);
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} Первый и последний день периода, в который входит дата. */
    private function bucket(CarbonImmutable $date, string $groupBy): array
    {
        return match ($groupBy) {
            self::GROUP_BY_WEEK => [
                $date->startOfWeek(CarbonImmutable::MONDAY),
                $date->startOfWeek(CarbonImmutable::MONDAY)->addDays(6),
            ],
            self::GROUP_BY_MONTH => [$date->startOfMonth(), $date->startOfMonth()->endOfMonth()->startOfDay()],
            default => [$date, $date],
        };
    }

    /** @return list<string> */
    private function ids(mixed $values): array
    {
        return is_array($values)
            ? array_values(array_unique(array_filter(array_map(
                static fn (mixed $value): string => trim((string) $value),
                $values,
            ), static fn (string $value): bool => $value !== '')))
            : [];
    }
}
