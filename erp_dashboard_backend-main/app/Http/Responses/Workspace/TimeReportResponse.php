<?php

namespace App\Http\Responses\Workspace;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TimeReportResponse extends JsonResponse
{
    /**
     * @param array{
     *     group_by: string,
     *     from: Carbon,
     *     to: Carbon,
     *     project_ids: list<string>,
     *     task_ids: list<string>,
     *     user_ids: list<string>,
     *     project_kinds: list<string>,
     *     manager_ids: list<string>,
     *     rows: Collection<int, array<string, mixed>>,
     *     own_seconds: int
     * } $report
     */
    public function __construct(array $report)
    {
        parent::__construct([
            'group_by' => $report['group_by'],
            'from' => $report['from']->toDateString(),
            'to' => $report['to']->toDateString(),
            'project_ids' => $report['project_ids'],
            'task_ids' => $report['task_ids'],
            'user_ids' => $report['user_ids'],
            'project_kinds' => $report['project_kinds'],
            'manager_ids' => $report['manager_ids'],
            'rows' => $report['rows'],
            'own_seconds' => $report['own_seconds'],
        ]);
    }
}
