<?php

namespace App\Services\Workspace\Reports;

use App\Models\User;
use App\Repositories\Workspace\Reports\TaskReportRepository;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class TaskReportService
{
    public function __construct(
        private readonly TaskReportRepository $reports,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{from: Carbon, to: Carbon, rows: Collection<int, array<string, mixed>>, total_seconds: int}
     */
    public function build(array $data, string $companyId, ?User $actor = null): array
    {
        $timezone = $this->reports->timezoneForCompany($companyId);
        $from = $this->boundary($data['from'], $timezone, true);
        $to = $this->boundary($data['to'], $timezone, false);
        $rangeTo = $this->exclusiveEnd($data['to'], $timezone);
        $projectIds = $this->ids($data['project_ids'] ?? [], $data['project_id'] ?? null);
        $taskIds = $this->ids($data['task_ids'] ?? [], $data['task_id'] ?? null);
        $userIds = $this->ids($data['user_ids'] ?? [], $data['user_id'] ?? null);
        $clientIds = $this->ids($data['client_ids'] ?? [], $data['client_id'] ?? null);

        if ($actor !== null) {
            $visibleProjectIds = $actor->visibleTaskProjectIds();
            if ($visibleProjectIds !== null) {
                $projectIds = $projectIds === []
                    ? $visibleProjectIds
                    : array_values(array_intersect($projectIds, $visibleProjectIds));
            }

            if ($actor->shouldRestrictTasksToOwnAssignments()) {
                $userIds = [(string) $actor->id];
            }
        }

        $rows = $this->reports->build(
            $companyId,
            $from,
            $rangeTo,
            (string) ($data['project_scope'] ?? 'all'),
            (string) ($data['task_scope'] ?? 'all'),
            (string) ($data['employee_scope'] ?? 'all'),
            $projectIds,
            $taskIds,
            $userIds,
            $clientIds,
        )->map($this->normalizeRow(...));

        return [
            'from' => $from,
            'to' => $to,
            'rows' => $rows,
            'total_seconds' => (int) $rows->sum('spent_seconds'),
        ];
    }

    /** @return array<string, mixed> */
    private function normalizeRow(object $row): array
    {
        /** @var list<array<string, mixed>> $assignees */
        $assignees = $this->decodeList($row->assignees ?? []);
        /** @var list<array<string, mixed>> $spentByUsers */
        $spentByUsers = $this->decodeList($row->spent_by_users ?? []);

        $assignees = array_values(array_filter(array_map(static function (array $assignee): ?array {
            $id = trim((string) ($assignee['id'] ?? ''));

            return $id === '' ? null : [
                'id' => $id,
                'name' => (string) ($assignee['name'] ?? ''),
                'last_name' => (string) ($assignee['last_name'] ?? ''),
                'status' => (string) ($assignee['status'] ?? ''),
            ];
        }, $assignees)));

        $spentByUsers = array_values(array_filter(array_map(static function (array $user): ?array {
            $id = trim((string) ($user['user_id'] ?? ''));

            return $id === '' ? null : [
                'user_id' => $id,
                'name' => (string) ($user['name'] ?? ''),
                'last_name' => (string) ($user['last_name'] ?? ''),
                'spent_seconds' => max(0, (int) ($user['spent_seconds'] ?? 0)),
            ];
        }, $spentByUsers)));

        return [
            ...(array) $row,
            'status' => $row->status ? (string) $row->status : null,
            'status_column_id' => $row->status_column_id ? (string) $row->status_column_id : null,
            'status_label' => $row->status_label,
            'status_slug' => $row->status_slug,
            'status_color' => $row->status_color,
            'status_is_final' => (bool) $row->status_is_final,
            'assignees' => $assignees,
            'spent_by_users' => $spentByUsers,
            'assignee_ids' => array_column($assignees, 'id'),
        ];
    }

    /** @return list<array<string, mixed>> */
    private function decodeList(mixed $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true);
        }

        if (! is_array($value)) {
            return [];
        }

        return array_values(array_filter($value, 'is_array'));
    }

    /** @return list<string> */
    private function ids(mixed $values, mixed $fallback = null): array
    {
        /** @var array<string, true> $ids */
        $ids = [];
        foreach (is_array($values) ? $values : [$values] as $value) {
            $id = trim((string) $value);
            if ($id !== '') {
                $ids[$id] = true;
            }
        }

        $fallbackId = trim((string) $fallback);
        if ($fallbackId !== '') {
            $ids[$fallbackId] = true;
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
