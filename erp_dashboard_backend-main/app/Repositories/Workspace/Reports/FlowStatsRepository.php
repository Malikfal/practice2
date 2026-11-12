<?php

namespace App\Repositories\Workspace\Reports;

use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Database\Query\JoinClause;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Часы сотрудников компании по проектам для рассылки статистики Flow в Telegram.
 *
 * Отрезок, который пересекает границу периода, делится по ней, как в отчете по времени.
 * Учитываются только сотрудники и проекты этой компании.
 */
class FlowStatsRepository
{
    /**
     * Секунды по сотрудникам и проектам за период [$from, $to).
     *
     * @param  list<string>  $excludedUserIds
     * @return Collection<int, object>
     */
    public function seconds(string $companyId, CarbonInterface $from, CarbonInterface $to, array $excludedUserIds = []): Collection
    {
        return $this->segments($companyId, $excludedUserIds)
            ->where('seg.started_at', '<', $to->timestamp)
            ->where('seg.ended_at', '>', $from->timestamp)
            ->selectRaw(
                'seg.user_id, u.name as user_first_name, u.last_name as user_last_name, u.email as user_email, '
                .'p.id as project_id, p.name as project_name, p.is_internal, '
                .'SUM(LEAST(seg.ended_at, ?) - GREATEST(seg.started_at, ?)) as seconds',
                [$to->timestamp, $from->timestamp],
            )
            ->groupBy('seg.user_id', 'u.name', 'u.last_name', 'u.email', 'p.id', 'p.name', 'p.is_internal')
            ->get();
    }

    /**
     * Секунды по дням, сотрудникам и проектам. Каждый день задан датой и границами в секундах [start, end).
     *
     * @param  list<array{date: string, start: int, end: int}>  $days
     * @param  list<string>  $excludedUserIds
     * @return Collection<int, object>
     */
    public function secondsByDay(string $companyId, array $days, array $excludedUserIds = []): Collection
    {
        if ($days === []) {
            return collect();
        }

        $bounds = null;
        foreach ($days as $day) {
            $query = DB::query()->selectRaw(
                'CAST(? AS VARCHAR(10)) as day_date, CAST(? AS BIGINT) as day_start, CAST(? AS BIGINT) as day_end',
                [$day['date'], $day['start'], $day['end']],
            );
            $bounds = $bounds === null ? $query : $bounds->unionAll($query);
        }

        return $this->segments($companyId, $excludedUserIds)
            ->where('seg.started_at', '<', max(array_column($days, 'end')))
            ->where('seg.ended_at', '>', min(array_column($days, 'start')))
            ->joinSub($bounds, 'd', static function (JoinClause $join): void {
                $join->on('seg.started_at', '<', 'd.day_end')->on('seg.ended_at', '>', 'd.day_start');
            })
            ->selectRaw(
                'd.day_date, seg.user_id, p.id as project_id, p.is_internal, '
                .'SUM(LEAST(seg.ended_at, d.day_end) - GREATEST(seg.started_at, d.day_start)) as seconds',
            )
            ->groupBy('d.day_date', 'seg.user_id', 'p.id', 'p.is_internal')
            ->get();
    }

    /**
     * @param  list<string>  $emails
     * @return list<string>
     */
    public function userIdsByEmails(string $companyId, array $emails): array
    {
        if ($emails === []) {
            return [];
        }

        return DB::table('users')
            ->where('company_id', $companyId)
            ->whereIn(DB::raw('LOWER(email)'), array_map(mb_strtolower(...), $emails))
            ->pluck('id')
            ->map(static fn (mixed $id): string => (string) $id)
            ->all();
    }

    /**
     * @param  list<string>  $excludedUserIds
     */
    private function segments(string $companyId, array $excludedUserIds): Builder
    {
        return DB::table('work_segments as seg')
            ->join('tasks as t', 't.id', '=', 'seg.task_id')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->join('users as u', 'u.id', '=', 'seg.user_id')
            ->where('p.company_id', $companyId)
            ->where('u.company_id', $companyId)
            ->when($excludedUserIds !== [], fn (Builder $query) => $query->whereNotIn('seg.user_id', $excludedUserIds));
    }
}
