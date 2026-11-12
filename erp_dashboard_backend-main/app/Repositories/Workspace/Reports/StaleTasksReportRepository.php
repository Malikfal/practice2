<?php

namespace App\Repositories\Workspace\Reports;

use App\Enums\ProjectStatus;
use App\Models\Company;
use App\Models\Task;
use Carbon\CarbonInterface;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Активные задачи активных проектов, по которым с момента $cutoff ничего не происходило.
 *
 * Движение по задаче — любое явное событие: создание задачи, запись в истории задачи (activity_log:
 * правка полей, смена исполнителей, смена статуса, комментарий, вложение, сообщение клиента),
 * комментарий, вложение и сегмент трекинга. tasks.updated_at не используется: его сдвигают
 * пересчёты позиций на доске (createTask и reorderColumn обновляют все задачи колонки).
 */
class StaleTasksReportRepository
{
    public function company(string $companyId): Company
    {
        return Company::query()->findOrFail($companyId);
    }

    /**
     * В строках — время последнего события из каждого источника, итог считает сервис.
     * Даты таблиц без часового пояса хранятся в UTC, сегменты — unix-время.
     *
     * @param  list<string>  $projectIds
     * @param  list<string>  $taskIds
     * @param  list<string>  $userIds  Задачи, где кто-то из них исполнитель.
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @param  list<string>  $statusNames  Названия статусов без учёта регистра и пробелов по краям.
     * @param  list<string>|null  $allowedProjectIds
     * @return Collection<int, object>
     */
    public function stale(
        string $companyId,
        CarbonInterface $cutoff,
        array $projectIds = [],
        array $taskIds = [],
        array $userIds = [],
        array $projectKinds = [],
        array $managerIds = [],
        array $statusNames = [],
        ?array $allowedProjectIds = null,
    ): Collection {
        // tasks.created_at — timestamptz, остальные даты — timestamp в UTC. Смещение в литерале PostgreSQL учтёт
        // для timestamptz и отбросит для timestamp, поэтому граница одинакова для обоих типов и не зависит
        // от часового пояса сессии. В SQLite даты сравниваются строками, смещение там помешало бы.
        $cutoffAt = $cutoff->copy()->utc()->format(DB::connection()->getDriverName() === 'pgsql' ? 'Y-m-d H:i:sP' : 'Y-m-d H:i:s');
        $cutoffTimestamp = $cutoff->getTimestamp();
        $taskMorphClass = (new Task)->getMorphClass();

        $query = $this->activeTasksQuery($companyId, $projectIds, $projectKinds, $managerIds, $allowedProjectIds)
            ->when($taskIds !== [], fn (Builder $query) => $query->whereIn('t.id', $taskIds))
            ->when($userIds !== [], fn (Builder $query) => $query->whereExists(
                static function (Builder $query) use ($userIds): void {
                    $query->selectRaw('1')
                        ->from('task_users as assignee')
                        ->whereColumn('assignee.task_id', 't.id')
                        ->whereIn('assignee.user_id', $userIds);
                },
            ))
            // Точное совпадение — для SQLite, где LOWER не понимает кириллицу; в PostgreSQL хватило бы LOWER.
            ->when($statusNames !== [], fn (Builder $query) => $query->where(
                static function (Builder $query) use ($statusNames): void {
                    $query->whereIn(DB::raw('TRIM(tsc.name)'), array_map(trim(...), $statusNames))
                        ->orWhereIn(
                            DB::raw('LOWER(TRIM(tsc.name))'),
                            array_map(static fn (string $name): string => mb_strtolower(trim($name)), $statusNames),
                        );
                },
            ))
            ->where('t.created_at', '<', $cutoffAt)
            ->whereNotExists(static function (Builder $query) use ($taskMorphClass, $cutoffAt): void {
                $query->selectRaw('1')
                    ->from('activity_log as log')
                    ->where('log.subject_type', $taskMorphClass)
                    ->whereColumn('log.subject_id', 't.id')
                    ->where('log.created_at', '>=', $cutoffAt);
            })
            ->whereNotExists(static function (Builder $query) use ($cutoffAt): void {
                $query->selectRaw('1')
                    ->from('task_comments as comment')
                    ->whereColumn('comment.task_id', 't.id')
                    ->where('comment.created_at', '>=', $cutoffAt);
            })
            ->whereNotExists(static function (Builder $query) use ($cutoffAt): void {
                $query->selectRaw('1')
                    ->from('task_attachments as attachment')
                    ->whereColumn('attachment.task_id', 't.id')
                    ->where('attachment.created_at', '>=', $cutoffAt);
            })
            ->whereNotExists(static function (Builder $query) use ($cutoffTimestamp): void {
                $query->selectRaw('1')
                    ->from('work_segments as seg')
                    ->whereColumn('seg.task_id', 't.id')
                    ->where('seg.ended_at', '>=', $cutoffTimestamp);
            });

        return $query
            ->select([
                'p.id as project_id',
                'p.name as project_name',
                't.id as task_id',
                't.title as task_name',
                'tsc.name as status_name',
                'tsc.color as status_color',
                't.created_at',
            ])
            ->selectSub(
                DB::table('activity_log as log')
                    ->selectRaw('MAX(log.created_at)')
                    ->where('log.subject_type', $taskMorphClass)
                    ->whereColumn('log.subject_id', 't.id'),
                'activity_at',
            )
            ->selectSub(
                DB::table('task_comments as comment')->selectRaw('MAX(comment.created_at)')->whereColumn('comment.task_id', 't.id'),
                'commented_at',
            )
            ->selectSub(
                DB::table('task_attachments as attachment')->selectRaw('MAX(attachment.created_at)')->whereColumn('attachment.task_id', 't.id'),
                'attached_at',
            )
            ->selectSub(
                DB::table('work_segments as seg')->selectRaw('MAX(seg.ended_at)')->whereColumn('seg.task_id', 't.id'),
                'tracked_until',
            )
            ->selectSub(
                DB::table('work_segments as seg')->selectRaw('SUM(seg.ended_at - seg.started_at)')->whereColumn('seg.task_id', 't.id'),
                'spent_seconds',
            )
            ->get();
    }

    /**
     * Названия статусов активных задач в доступных проектах — варианты фильтра по статусам.
     * Колонки у каждого проекта свои, поэтому одноимённые статусы объединяются.
     *
     * @param  list<string>|null  $allowedProjectIds
     * @return list<string>
     */
    public function statusNames(string $companyId, ?array $allowedProjectIds = null): array
    {
        return DB::table('task_status_columns as tsc')
            ->join('projects as p', 'p.id', '=', 'tsc.project_id')
            ->where('p.company_id', $companyId)
            ->where('p.status', ProjectStatus::ACTIVE->value)
            ->where(static fn (Builder $query) => $query->where('tsc.is_final', false)->orWhereNull('tsc.is_final'))
            ->whereRaw("TRIM(tsc.name) <> ''")
            ->when($allowedProjectIds !== null, fn (Builder $query) => $query->whereIn('p.id', $allowedProjectIds))
            ->selectRaw('MIN(TRIM(tsc.name)) as name, MIN(tsc.position) as first_position')
            ->groupByRaw('LOWER(TRIM(tsc.name))')
            ->orderBy('first_position')
            ->orderBy('name')
            ->pluck('name')
            ->map(static fn (mixed $name): string => (string) $name)
            ->values()
            ->all();
    }

    /**
     * Опубликованные задачи не в финальном статусе из проектов со статусом «Активный».
     *
     * @param  list<string>  $projectIds
     * @param  list<string>  $projectKinds
     * @param  list<string>  $managerIds
     * @param  list<string>|null  $allowedProjectIds
     */
    private function activeTasksQuery(
        string $companyId,
        array $projectIds,
        array $projectKinds,
        array $managerIds,
        ?array $allowedProjectIds,
    ): Builder {
        return DB::table('tasks as t')
            ->join('projects as p', 'p.id', '=', 't.project_id')
            ->leftJoin('task_status_columns as tsc', 'tsc.id', '=', 't.task_status_column_id')
            ->where('p.company_id', $companyId)
            ->where('p.status', ProjectStatus::ACTIVE->value)
            ->where(static fn (Builder $query) => $query->whereNull('tsc.id')->orWhere('tsc.is_final', false))
            ->where(static fn (Builder $query) => $query->where('t.is_draft', false)->orWhereNull('t.is_draft'))
            ->when(
                $projectIds !== [] || $projectKinds !== [],
                fn (Builder $query) => $this->applyProjectSelection($query, $projectIds, $projectKinds),
            )
            ->when($allowedProjectIds !== null, fn (Builder $query) => $query->whereIn('p.id', $allowedProjectIds))
            ->when($managerIds !== [], fn (Builder $query) => $query->whereExists(
                static function (Builder $query) use ($managerIds): void {
                    $query->selectRaw('1')
                        ->from('project_members as manager_member')
                        ->whereColumn('manager_member.project_id', 'p.id')
                        ->where('manager_member.is_pm', true)
                        ->whereIn('manager_member.user_id', $managerIds);
                },
            ));
    }

    /**
     * Как в отчёте по времени: подходит проект из списка или проект выбранного типа.
     *
     * @param  list<string>  $projectIds
     * @param  list<string>  $projectKinds
     */
    private function applyProjectSelection(Builder $query, array $projectIds, array $projectKinds): Builder
    {
        return $query->where(static function (Builder $query) use ($projectIds, $projectKinds): void {
            if ($projectIds !== []) {
                $query->orWhereIn('p.id', $projectIds);
            }

            if (in_array(TimeReportRepository::PROJECT_KIND_INTERNAL, $projectKinds, true)) {
                $query->orWhere('p.is_internal', true);
            }

            if (in_array(TimeReportRepository::PROJECT_KIND_COMMERCIAL, $projectKinds, true)) {
                $query->orWhere(static function (Builder $query): void {
                    $query->where('p.is_internal', false)->orWhereNull('p.is_internal');
                });
            }
        });
    }
}
