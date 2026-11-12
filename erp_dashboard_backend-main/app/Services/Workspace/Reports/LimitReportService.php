<?php

namespace App\Services\Workspace\Reports;

use App\Models\User;
use App\Repositories\Workspace\Reports\LimitReportRepository;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Отчёт «Лимитные проекты»: время за период против недельного лимита проекта или клиента.
 *
 * Лимит клиента главнее лимита проекта и общий на все проекты клиента: время всех его проектов
 * в отчёте складывается и сравнивается с одним лимитом. Лимит за период — недельный лимит × дней / 7.
 *
 * @phpstan-type LimitReportProjectRow array{
 *     project_id: string,
 *     project_name: string|null,
 *     client_id: string|null,
 *     client_name: string|null,
 *     limit_source: 'client'|'project',
 *     project_weekly_limit_seconds: int|null,
 *     weekly_limit_seconds: int,
 *     limit_seconds: int,
 *     spent_seconds: int,
 *     limit_spent_seconds: int
 * }
 * @phpstan-type LimitReportClientRow array{
 *     client_id: string|null,
 *     client_name: string|null,
 *     weekly_limit_seconds: int|null,
 *     limit_seconds: int|null,
 *     spent_seconds: int,
 *     projects: list<LimitReportProjectRow>
 * }
 */
class LimitReportService
{
    public const GROUP_BY_PROJECT = 'project';

    public const GROUP_BY_CLIENT = 'client';

    public const GROUPS = [self::GROUP_BY_PROJECT, self::GROUP_BY_CLIENT];

    /** Откуда взят лимит строки проекта. */
    public const LIMIT_SOURCE_CLIENT = 'client';

    public const LIMIT_SOURCE_PROJECT = 'project';

    public function __construct(
        private readonly TimeReportService $timeReports,
        private readonly TimeReportRepository $timeReportRepository,
        private readonly LimitReportRepository $reports,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function build(array $data, string $companyId, ?User $actor = null): array
    {
        $scope = $this->timeReports->scope($data, $this->timeReportRepository->timezoneForCompany($companyId), $actor);
        $groupBy = (string) ($data['group_by'] ?? self::GROUP_BY_PROJECT);
        $periodDays = $this->periodDays($scope['from'], $scope['to']);

        /** @var Collection<int, object> $projects */
        $projects = collect();
        if ($scope['has_available_projects']) {
            $projects = $this->reports->projects(
                $companyId,
                $scope['from'],
                $scope['range_to'],
                $scope['project_ids'],
                $scope['task_ids'],
                $scope['user_ids'],
                $scope['project_kinds'],
                $scope['manager_ids'],
                $scope['allowed_project_ids'],
            );
        }

        // Время всех проектов клиента в отчёте, которое расходует общий лимит клиента.
        /** @var array<string, int> $clientSpent */
        $clientSpent = [];
        foreach ($projects as $project) {
            if ($project->client_weekly_limit_seconds !== null) {
                $clientId = (string) $project->client_id;
                $clientSpent[$clientId] = ($clientSpent[$clientId] ?? 0) + (int) $project->spent_seconds;
            }
        }

        /** @var Collection<int, LimitReportProjectRow> $rows */
        $rows = $projects->map(function (object $project) use ($clientSpent, $periodDays): array {
            $clientLimit = $this->nullableInt($project->client_weekly_limit_seconds);
            $projectLimit = $this->nullableInt($project->project_weekly_limit_seconds);
            $weeklyLimit = $clientLimit ?? (int) $projectLimit;
            $spent = (int) $project->spent_seconds;

            return [
                'project_id' => (string) $project->project_id,
                'project_name' => $project->project_name !== null ? (string) $project->project_name : null,
                'client_id' => $project->client_id !== null ? (string) $project->client_id : null,
                'client_name' => $project->client_name !== null ? (string) $project->client_name : null,
                'limit_source' => $clientLimit !== null ? self::LIMIT_SOURCE_CLIENT : self::LIMIT_SOURCE_PROJECT,
                'project_weekly_limit_seconds' => $projectLimit,
                'weekly_limit_seconds' => $weeklyLimit,
                'limit_seconds' => $this->periodLimit($weeklyLimit, $periodDays),
                'spent_seconds' => $spent,
                'limit_spent_seconds' => $clientLimit !== null ? $clientSpent[(string) $project->client_id] : $spent,
            ];
        })->values();

        // Каждый лимит считается один раз: лимит клиента общий для всех его строк.
        $limits = $rows->unique(static fn (array $row): string => $row['limit_source'] === self::LIMIT_SOURCE_CLIENT
            ? 'client:'.$row['client_id']
            : 'project:'.$row['project_id']);

        return [
            'group_by' => $groupBy,
            ...$this->timeReports->filters($scope),
            'period_days' => $periodDays,
            'rows' => $groupBy === self::GROUP_BY_CLIENT ? $this->groupByClient($rows) : $rows,
            'spent_seconds' => (int) $rows->sum('spent_seconds'),
            'limit_seconds' => (int) $limits->sum('limit_seconds'),
            // Превышение одного лимита не покрывается запасом другого, поэтому суммы раздельные.
            'over_limit_seconds' => (int) $limits->sum(
                static fn (array $row): int => max(0, $row['limit_spent_seconds'] - $row['limit_seconds']),
            ),
            'remaining_seconds' => (int) $limits->sum(
                static fn (array $row): int => max(0, $row['limit_seconds'] - $row['limit_spent_seconds']),
            ),
        ];
    }

    /** Лимит за период: 15 ч в неделю за 14 дней — 30 ч. */
    public function periodLimit(int $weeklyLimitSeconds, int $periodDays): int
    {
        return (int) round($weeklyLimitSeconds * $periodDays / 7);
    }

    /** Календарные дни периода включительно, по датам часового пояса компании. */
    private function periodDays(Carbon $from, Carbon $to): int
    {
        $firstDay = CarbonImmutable::parse($from->toDateString(), 'UTC');
        $lastDay = CarbonImmutable::parse($to->toDateString(), 'UTC');

        return max(1, (int) $firstDay->diffInDays($lastDay) + 1);
    }

    /**
     * Строки клиентов по алфавиту, проекты без клиента — последней группой.
     *
     * @param  Collection<int, LimitReportProjectRow>  $rows
     * @return Collection<int, LimitReportClientRow>
     */
    private function groupByClient(Collection $rows): Collection
    {
        return $rows
            ->groupBy(static fn (array $row): string => $row['client_id'] ?? '')
            ->map(static function (Collection $projects): array {
                /** @var LimitReportProjectRow $first */
                $first = $projects->first();
                $hasClientLimit = $first['limit_source'] === self::LIMIT_SOURCE_CLIENT;

                return [
                    'client_id' => $first['client_id'],
                    'client_name' => $first['client_name'],
                    'weekly_limit_seconds' => $hasClientLimit ? $first['weekly_limit_seconds'] : null,
                    'limit_seconds' => $hasClientLimit ? $first['limit_seconds'] : null,
                    'spent_seconds' => (int) $projects->sum('spent_seconds'),
                    'projects' => $projects->values()->all(),
                ];
            })
            ->sort(static function (array $left, array $right): int {
                if (($left['client_id'] === null) !== ($right['client_id'] === null)) {
                    return $left['client_id'] === null ? 1 : -1;
                }

                return [mb_strtolower((string) $left['client_name']), (string) $left['client_id']]
                    <=> [mb_strtolower((string) $right['client_name']), (string) $right['client_id']];
            })
            ->values();
    }

    private function nullableInt(mixed $value): ?int
    {
        return $value === null ? null : (int) $value;
    }
}
