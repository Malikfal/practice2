<?php

namespace App\Services\Workspace\Reports;

use App\Enums\UserRole;
use App\Models\User;
use App\Repositories\Workspace\Reports\StaleTasksReportRepository;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Отчёт «Задачи без движения»: активные задачи активных проектов, с которыми ничего не происходит
 * {@see self::THRESHOLD_DAYS} календарных дня и дольше по часовому поясу компании.
 *
 * @phpstan-type StaleTaskRow array{
 *     project_id: string,
 *     project_name: string|null,
 *     task_id: string,
 *     task_name: string|null,
 *     status_name: string|null,
 *     status_color: string|null,
 *     spent_seconds: int,
 *     last_moved_at: string,
 *     last_moved_on: string,
 *     idle_days: int
 * }
 */
class StaleTasksReportService
{
    /** Сколько календарных дней без движения достаточно, чтобы задача попала в отчёт. */
    public const THRESHOLD_DAYS = 3;

    public function __construct(
        private readonly StaleTasksReportRepository $reports,
    ) {}

    /**
     * Период не применяется: отчёт — снимок на сегодня. Сотрудник выбирает задачи, где он исполнитель.
     *
     * @param  array<string, mixed>  $data
     * @return array{
     *     threshold_days: int,
     *     today: string,
     *     project_ids: list<string>,
     *     task_ids: list<string>,
     *     user_ids: list<string>,
     *     project_kinds: list<string>,
     *     manager_ids: list<string>,
     *     status_names: list<string>,
     *     available_statuses: list<string>,
     *     rows: Collection<int, StaleTaskRow>,
     *     spent_seconds: int
     * }
     */
    public function build(array $data, string $companyId, ?User $actor = null): array
    {
        $timezone = $this->reports->company($companyId)->payrollTimezone();
        $today = Carbon::now($timezone)->startOfDay();
        // Последний день движения не позже чем THRESHOLD_DAYS дней назад: 27-го в отчёт попадает движение 24-го и раньше.
        $cutoff = $today->copy()->subDays(self::THRESHOLD_DAYS - 1);

        $projectIds = $this->ids($data['project_ids'] ?? []);
        $projectKinds = $this->ids($data['project_kinds'] ?? []);
        $taskIds = $this->ids($data['task_ids'] ?? []);
        $userIds = $this->ids($data['user_ids'] ?? []);
        $managerIds = $this->ids($data['manager_ids'] ?? []);
        $statusNames = $this->ids($data['status_names'] ?? []);

        // Менеджер видит только проекты, где он назначен, как в отчёте по времени.
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

        // У менеджера пустой выбор после пересечения означает «нет доступных проектов», а не «все проекты».
        $hasAvailableProjects = ! $restrictProjects
            || ($allowedProjectIds !== [] && ($projectIds !== [] || $projectKinds !== []));

        /** @var Collection<int, object> $staleRows */
        $staleRows = collect();
        if ($hasAvailableProjects) {
            $staleRows = $this->reports->stale(
                $companyId,
                $cutoff,
                $projectIds,
                $taskIds,
                $userIds,
                $projectKinds,
                $managerIds,
                $statusNames,
                $allowedProjectIds,
            );
        }

        $todayDate = Carbon::parse($today->toDateString(), 'UTC');
        $rows = $staleRows
            ->map(function (object $row) use ($timezone, $todayDate): array {
                $lastMovedAt = $this->lastMovedAt($row);
                $lastMovedOn = $lastMovedAt->copy()->setTimezone($timezone)->toDateString();

                return [
                    'project_id' => (string) $row->project_id,
                    'project_name' => isset($row->project_name) ? (string) $row->project_name : null,
                    'task_id' => (string) $row->task_id,
                    'task_name' => isset($row->task_name) ? (string) $row->task_name : null,
                    'status_name' => isset($row->status_name) ? (string) $row->status_name : null,
                    'status_color' => isset($row->status_color) ? (string) $row->status_color : null,
                    'spent_seconds' => (int) ($row->spent_seconds ?? 0),
                    'last_moved_at' => $lastMovedAt->toIso8601String(),
                    'last_moved_on' => $lastMovedOn,
                    'idle_days' => (int) round(abs(Carbon::parse($lastMovedOn, 'UTC')->diffInDays($todayDate))),
                ];
            })
            // Дольше всех без движения — сверху.
            ->sortBy([
                ['last_moved_at', 'asc'],
                ['project_name', 'asc'],
                ['task_name', 'asc'],
                ['task_id', 'asc'],
            ])
            ->values();

        return [
            'threshold_days' => self::THRESHOLD_DAYS,
            'today' => $today->toDateString(),
            'project_ids' => $projectIds,
            'task_ids' => $taskIds,
            'user_ids' => $userIds,
            'project_kinds' => $projectKinds,
            'manager_ids' => $managerIds,
            'status_names' => $statusNames,
            'available_statuses' => $this->reports->statusNames($companyId, $allowedProjectIds),
            'rows' => $rows,
            'spent_seconds' => (int) $rows->sum('spent_seconds'),
        ];
    }

    /** Самое позднее событие по задаче в UTC; создание задачи есть всегда. */
    private function lastMovedAt(object $row): CarbonInterface
    {
        $moments = [Carbon::parse((string) $row->created_at, 'UTC')];

        foreach (['activity_at', 'commented_at', 'attached_at'] as $field) {
            if (isset($row->{$field}) && $row->{$field} !== '') {
                $moments[] = Carbon::parse((string) $row->{$field}, 'UTC');
            }
        }

        if (isset($row->tracked_until)) {
            $moments[] = Carbon::createFromTimestamp((int) $row->tracked_until, 'UTC');
        }

        return collect($moments)
            ->sortByDesc(static fn (CarbonInterface $moment): int => $moment->getTimestamp())
            ->first()
            ->copy()
            ->utc();
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
}
