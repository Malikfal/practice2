<?php

namespace App\Services\Workspace\Reports;

use App\Repositories\Workspace\Reports\WorkSegmentsReportRepository;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class WorkSegmentsReportService
{
    public function __construct(
        private readonly WorkSegmentsReportRepository $reports,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, array<string, mixed>>
     */
    public function build(array $data, ?string $companyId = null): array
    {
        $from = Carbon::parse($data['start']);
        $to = Carbon::parse($data['end']);
        $userId = isset($data['userId']) ? (string) $data['userId'] : null;

        /** @var array<string, array<string, mixed>> $grouped */
        $grouped = [];
        foreach ($this->reports->build($from, $to, $userId, $companyId) as $row) {
            $userKey = (string) $row->user_id;
            $projectKey = (string) $row->project_id;
            $durationSeconds = (int) $row->segment_duration_seconds;

            $grouped[$userKey] ??= [
                'user' => [
                    'id' => $userKey,
                    'createdAt' => $this->dateTime($row->user_created_at),
                    'updatedAt' => $this->dateTime($row->user_updated_at),
                    'email' => $row->user_email,
                    'name' => $row->user_name,
                    'role' => $row->user_role,
                    'status' => $row->user_status,
                ],
                'totalDurationForAllProjects' => 0,
                'projects' => [],
            ];
            $grouped[$userKey]['projects'][$projectKey] ??= [
                'project' => [
                    'id' => $projectKey,
                    'createdAt' => $this->dateTime($row->project_created_at),
                    'updatedAt' => $this->dateTime($row->project_updated_at),
                    'name' => $row->project_name,
                    'description' => $row->project_description,
                    'createdById' => $row->project_created_by_id,
                    'companyId' => $row->project_company_id,
                ],
                'totalDuration' => 0,
                'workSegments' => [],
            ];

            $grouped[$userKey]['totalDurationForAllProjects'] += $durationSeconds;
            $grouped[$userKey]['projects'][$projectKey]['totalDuration'] += $durationSeconds;
            $grouped[$userKey]['projects'][$projectKey]['workSegments'][] = [
                'id' => $row->segment_id,
                'startedAt' => (int) $row->segment_started_at,
                'endedAt' => (int) $row->segment_ended_at,
                'durationSeconds' => $durationSeconds,
                'taskId' => $row->segment_task_id,
                'taskTitle' => $row->segment_task_title,
            ];
        }

        foreach ($grouped as &$userGroup) {
            $userGroup['projects'] = array_values($userGroup['projects']);
        }

        return $grouped;
    }

    private function dateTime(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return ($value instanceof CarbonInterface ? $value : Carbon::parse($value))
            ->format('Y-m-d\TH:i:s');
    }
}
