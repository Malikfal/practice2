<?php

namespace App\Repositories\Workspace\Reports;

use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class WorkSegmentsReportRepository
{
    /** @return Collection<int, object> */
    public function build(
        CarbonInterface $from,
        CarbonInterface $to,
        ?string $userId,
        ?string $companyId = null,
    ): Collection {
        return DB::table('work_segments as seg')
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->leftJoin('roles as r', 'r.id', '=', 'u.role_id')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->where('seg.started_at', '>=', $from->timestamp)
            ->where('seg.ended_at', '<=', $to->timestamp)
            ->when($companyId, function ($query, string $companyId): void {
                $query->where('u.company_id', $companyId)->where('p.company_id', $companyId);
            })
            ->when($userId, fn ($query, string $userId) => $query->where('seg.user_id', $userId))
            ->orderBy('u.name')
            ->orderBy('p.name')
            ->orderBy('seg.started_at')
            ->selectRaw('
                u.id as user_id,
                u.created_at as user_created_at,
                u.updated_at as user_updated_at,
                u.email as user_email,
                u.name as user_name,
                r.name as user_role,
                u.status as user_status,
                p.id as project_id,
                p.created_at as project_created_at,
                p.updated_at as project_updated_at,
                p.name as project_name,
                p.description as project_description,
                p.created_by_id as project_created_by_id,
                p.company_id as project_company_id,
                seg.id as segment_id,
                seg.started_at as segment_started_at,
                seg.ended_at as segment_ended_at,
                seg.task_id as segment_task_id,
                t.title as segment_task_title,
                (seg.ended_at - seg.started_at) as segment_duration_seconds
            ')
            ->get();
    }
}
