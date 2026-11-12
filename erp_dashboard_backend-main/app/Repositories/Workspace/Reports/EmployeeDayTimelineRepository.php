<?php

namespace App\Repositories\Workspace\Reports;

use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class EmployeeDayTimelineRepository
{
    /** @return Collection<int, object> */
    public function build(
        string $companyId,
        string $userId,
        CarbonInterface $from,
        CarbonInterface $to,
    ): Collection {
        return DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->leftJoin('users as creator', 'creator.id', '=', 'seg.created_by')
            ->where('p.company_id', $companyId)
            ->where('seg.user_id', $userId)
            ->where('seg.started_at', '<', $to->timestamp)
            ->where('seg.ended_at', '>', $from->timestamp)
            ->orderBy('seg.started_at')
            ->get([
                'seg.id',
                'seg.started_at',
                'seg.ended_at',
                'seg.note',
                'seg.created_by',
                'creator.name as created_by_name',
                't.id as task_id',
                't.title as task_name',
                'p.id as project_id',
                'p.name as project_name',
            ]);
    }
}
