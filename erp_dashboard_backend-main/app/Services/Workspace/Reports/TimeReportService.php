<?php

namespace App\Services\Workspace\Reports;

use App\Enums\UserRole;
use App\Models\User;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * @phpstan-type TimeReportRow array{
 *     date?: string,
 *     project_id?: string,
 *     project_name?: string|null,
 *     task_id?: string,
 *     task_name?: string|null,
 *     user_id?: string,
 *     user_name?: string|null,
 *     own_seconds: int
 * }
 * @phpstan-type OverrunReportRow array{
 *     project_id: string,
 *     project_name: string|null,
 *     task_id: string,
 *     task_name: string|null,
 *     estimation_seconds: int|null,
 *     spent_seconds: int
 * }
 */
class TimeReportService
{
    public function __construct(
        private readonly TimeReportRepository $reports,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{
     *     group_by: string,
     *     from: Carbon,
     *     to: Carbon,
     *     project_ids: list<string>,
     *     task_ids: list<string>,
     *     user_ids: list<string>,
     *     project_kinds: list<string>,
     *     manager_ids: list<string>,
     *     rows: Collection<int, TimeReportRow>,
     *     own_seconds: int
     * }
     */
    public function build(array $data, string $companyId, ?User $actor = null): array
    {
        $timezone = $this->reports->timezoneForCompany($companyId);
        $scope = $this->scope($data, $timezone, $actor);
        $groupBy = (string) $data['group_by'];

        /** @var Collection<int, object> $ownRows */
        $ownRows = collect();
        if ($scope['has_available_projects']) {
            $ownRows = $this->reports->own(
                $companyId,
                $scope['from'],
                $scope['range_to'],
                $groupBy,
                $scope['project_ids'],
                $scope['task_ids'],
                $scope['user_ids'],
                timezone: $timezone,
                projectKinds: $scope['project_kinds'],
                managerIds: $scope['manager_ids'],
                allowedProjectIds: $scope['allowed_project_ids'],
            );
        }

        $rows = $ownRows->map(fn (object $row): array => [
            ...$this->dimensions((array) $row, $groupBy),
            'own_seconds' => (int) data_get($row, 'duration_seconds', 0),
        ]);

        return [
            'group_by' => $groupBy,
            ...$this->filters($scope),
            'rows' => $rows,
            'own_seconds' => (int) $rows->sum('own_seconds'),
        ];
    }

    /**
     * Отчет по перерасходу: задачи с временем в периоде, где затраченное за всю задачу больше оценки.
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *     from: Carbon,
     *     to: Carbon,
     *     project_ids: list<string>,
     *     task_ids: list<string>,
     *     user_ids: list<string>,
     *     project_kinds: list<string>,
     *     manager_ids: list<string>,
     *     unestimated_task_limit_seconds: int,
     *     rows: Collection<int, OverrunReportRow>,
     *     spent_seconds: int
     * }
     */
    public function overrun(array $data, string $companyId, ?User $actor = null): array
    {
        $company = $this->reports->company($companyId);
        $scope = $this->scope($data, $company->payrollTimezone(), $actor);
        $unestimatedLimit = $company->unestimatedTaskLimitSeconds();

        /** @var Collection<int, object> $overrunRows */
        $overrunRows = collect();
        if ($scope['has_available_projects']) {
            $overrunRows = $this->reports->overrun(
                $companyId,
                $scope['from'],
                $scope['range_to'],
                $unestimatedLimit,
                $scope['project_ids'],
                $scope['task_ids'],
                $scope['user_ids'],
                projectKinds: $scope['project_kinds'],
                managerIds: $scope['manager_ids'],
                allowedProjectIds: $scope['allowed_project_ids'],
            );
        }

        $rows = $overrunRows->map(static function (object $row): array {
            $estimation = (int) ($row->estimation_seconds ?? 0);

            return [
                'project_id' => (string) $row->project_id,
                'project_name' => isset($row->project_name) ? (string) $row->project_name : null,
                'task_id' => (string) $row->task_id,
                'task_name' => isset($row->task_name) ? (string) $row->task_name : null,
                'estimation_seconds' => $estimation > 0 ? $estimation : null,
                'spent_seconds' => (int) $row->spent_seconds,
            ];
        });

        return [
            ...$this->filters($scope),
            'unestimated_task_limit_seconds' => $unestimatedLimit,
            'rows' => $rows,
            'spent_seconds' => (int) $rows->sum('spent_seconds'),
        ];
    }

    /**
     * Период и фильтры отчета. Менеджер видит только проекты, где он назначен.
     * Общие для отчетов с фильтрами отчета по времени, например {@see LimitReportService}.
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *     from: Carbon,
     *     to: Carbon,
     *     range_to: Carbon,
     *     project_ids: list<string>,
     *     task_ids: list<string>,
     *     user_ids: list<string>,
     *     project_kinds: list<string>,
     *     manager_ids: list<string>,
     *     allowed_project_ids: list<string>|null,
     *     has_available_projects: bool
     * }
     */
    public function scope(array $data, string $timezone, ?User $actor): array
    {
        $projectIds = $this->ids($data['project_ids'] ?? []);
        $projectKinds = $this->ids($data['project_kinds'] ?? []);

        $restrictProjects = (string) $actor?->role === UserRole::MANAGER->value;
        /** @var list<string>|null $allowedProjectIds */
        $allowedProjectIds = null;
        if ($restrictProjects) {
            /** @var list<string> $assignedProjectIds */
            $assignedProjectIds = $actor->assignedProjectIds()
                ->map(static fn (mixed $id): string => (string) $id)
                ->values()
                ->all();
            $allowedProjectIds = $assignedProjectIds;

            if ($projectIds !== []) {
                $projectIds = array_values(array_intersect($projectIds, $assignedProjectIds));
            } elseif ($projectKinds === []) {
                $projectIds = $assignedProjectIds;
            }
        }

        return [
            'from' => $this->boundary($data['from'], $timezone, true),
            'to' => $this->boundary($data['to'], $timezone, false),
            'range_to' => $this->exclusiveEnd($data['to'], $timezone),
            'project_ids' => $projectIds,
            'task_ids' => $this->ids($data['task_ids'] ?? []),
            'user_ids' => $this->ids($data['user_ids'] ?? []),
            'project_kinds' => $projectKinds,
            'manager_ids' => $this->ids($data['manager_ids'] ?? []),
            'allowed_project_ids' => $allowedProjectIds,
            // У менеджера пустой выбор после пересечения означает «нет доступных проектов», а не «все проекты».
            'has_available_projects' => ! $restrictProjects
                || ($allowedProjectIds !== [] && ($projectIds !== [] || $projectKinds !== [])),
        ];
    }

    /**
     * @param  array<string, mixed>  $scope
     * @return array<string, mixed>
     */
    public function filters(array $scope): array
    {
        return [
            'from' => $scope['from'],
            'to' => $scope['to'],
            'project_ids' => $scope['project_ids'],
            'task_ids' => $scope['task_ids'],
            'user_ids' => $scope['user_ids'],
            'project_kinds' => $scope['project_kinds'],
            'manager_ids' => $scope['manager_ids'],
        ];
    }

    /**
     * @param  array<string, mixed>  $row
     * @return array<string, string|null>
     */
    private function dimensions(array $row, string $groupBy): array
    {
        return match ($groupBy) {
            'day' => ['date' => (string) $row['date']],
            'task' => [
                'project_id' => (string) $row['project_id'],
                'project_name' => isset($row['project_name']) ? (string) $row['project_name'] : null,
                'task_id' => (string) $row['task_id'],
                'task_name' => isset($row['task_name']) ? (string) $row['task_name'] : null,
            ],
            'project' => [
                'project_id' => (string) $row['project_id'],
                'project_name' => isset($row['project_name']) ? (string) $row['project_name'] : null,
            ],
            default => [
                'user_id' => (string) $row['user_id'],
                'user_name' => isset($row['user_name']) ? (string) $row['user_name'] : null,
            ],
        };
    }

    /** @return list<string> */
    private function ids(mixed $values): array
    {
        if (! is_array($values)) {
            return [];
        }

        /** @var array<string, true> $ids */
        $ids = [];
        foreach ($values as $value) {
            $id = trim((string) $value);
            if ($id !== '') {
                $ids[$id] = true;
            }
        }

        return array_keys($ids);
    }

    private function boundary(mixed $value, string $timezone, bool $start): Carbon
    {
        $raw = trim((string) $value);
        $date = Carbon::parse($raw, $timezone)->setTimezone($timezone);

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) === 1) {
            return $start ? $date->startOfDay() : $date->endOfDay();
        }

        return $date;
    }

    private function exclusiveEnd(mixed $value, string $timezone): Carbon
    {
        $raw = trim((string) $value);
        $date = Carbon::parse($raw, $timezone)->setTimezone($timezone);

        return preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw) === 1
            ? $date->startOfDay()->addDay()
            : $date;
    }
}
