<?php

namespace App\Services\ClientPortal;

use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\ProjectDocument;
use App\Models\Task;
use App\Models\User;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Workspace\ProjectService;
use App\Services\Workspace\TaskActivityService;
use App\Services\Workspace\TrackerSettingsService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Доступ клиентского аккаунта к проектам и задачам и данные, которые ему можно отдать.
 */
class ClientPortalService
{
    public function __construct(
        private readonly ProjectService $projects,
        private readonly TaskActivityService $activity,
        private readonly TrackerSettingsService $trackerSettings,
        private readonly TaskNotificationService $notifications,
    ) {}

    /**
     * Проекты клиента, открытые этому аккаунту, включая архивные и внутренние.
     *
     * @return Builder<Project>
     */
    public function projectsQuery(User $user): Builder
    {
        return Project::query()
            ->where('company_id', $user->company_id)
            ->where('client_id', $user->client_id)
            ->when(
                ! $user->client_all_projects,
                fn (Builder $query) => $query->whereIn('id', $user->clientProjects()->select('projects.id')),
            );
    }

    /**
     * Задачи, которые клиент видит на доске: отмеченные «Видна клиенту».
     * Черновик (задача без исполнителя) клиент видит как обычную задачу; пустой черновик без названия — нет.
     *
     * @return Builder<Task>
     */
    public function visibleTasksQuery(User $user): Builder
    {
        return Task::query()
            ->whereIn('project_id', $this->projectsQuery($user)->select('projects.id'))
            ->where('is_client_visible', true)
            ->where(fn (Builder $query) => $query
                ->where('is_draft', false)
                ->orWhereRaw("TRIM(COALESCE(title, '')) <> ''"));
    }

    public function assertProjectAccess(User $user, Project $project): void
    {
        abort_unless($this->projectsQuery($user)->whereKey($project->id)->exists(), 404);
    }

    public function assertTaskAccess(User $user, Task $task): void
    {
        abort_unless($this->visibleTasksQuery($user)->whereKey($task->id)->exists(), 404);
    }

    /**
     * Архивный проект клиент только просматривает.
     */
    public function assertProjectWritable(Project $project): void
    {
        abort_if($project->status === ProjectStatus::ARCHIVED, 409, 'Проект в архиве, изменения недоступны.');
    }

    /**
     * @param  Collection<int, Task>  $tasks
     * @return Collection<int, array<string, mixed>>
     */
    public function taskPayloads(User $user, Collection $tasks): Collection
    {
        $permissions = $user->effectivePermissionNames();
        $can = static fn (UserPermission $permission): bool => $permissions->contains($permission->value);
        $spentSeconds = $can(UserPermission::CLIENT_PORTAL_TASK_SPENT_TIME_VIEW)
            ? $this->spentSeconds($tasks->pluck('id')->all())
            : collect();

        return $tasks->map(fn (Task $task): array => [
            'id' => (string) $task->id,
            'title' => $task->title,
            'project_id' => (string) $task->project_id,
            'project' => $task->project?->name,
            'parent_task_id' => $task->parent_task_id ? (string) $task->parent_task_id : null,
            'status' => $task->statusColumn?->name,
            'status_column_id' => $task->task_status_column_id ? (string) $task->task_status_column_id : null,
            'is_final' => (bool) $task->statusColumn?->is_final,
            'approval_status' => $task->client_approval_status,
            'created_at' => $task->created_at?->toISOString(),
            'description' => $can(UserPermission::CLIENT_PORTAL_TASK_DESCRIPTION_VIEW)
                ? $this->clientDescription($task)
                : null,
            'estimation' => $can(UserPermission::CLIENT_PORTAL_TASK_ESTIMATION_VIEW) ? $task->estimation : null,
            // Кто может менять поле, должен видеть его текущее значение.
            'priority' => $can(UserPermission::CLIENT_PORTAL_TASK_PRIORITY_VIEW) || $can(UserPermission::CLIENT_PORTAL_TASK_PRIORITY_UPDATE)
                ? $task->priority
                : null,
            'deadline' => $can(UserPermission::CLIENT_PORTAL_TASK_DEADLINE_VIEW) || $can(UserPermission::CLIENT_PORTAL_TASK_DEADLINE_SET)
                ? $task->deadline
                : null,
            'spent_seconds' => $can(UserPermission::CLIENT_PORTAL_TASK_SPENT_TIME_VIEW)
                ? (int) ($spentSeconds[(string) $task->id] ?? 0)
                : null,
        ])->values();
    }

    /**
     * @param  array{title: string, description?: string|null, priority?: string|null, deadline?: string|null}  $data
     */
    public function createTask(User $user, Project $project, array $data): Task
    {
        $this->assertProjectAccess($user, $project);
        $this->assertProjectWritable($project);

        $task = $this->projects->createTask($user, $project, [
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'priority' => $data['priority'] ?? null,
            'deadline' => $data['deadline'] ?? null,
            'status_name' => $this->trackerSettings->effectiveClientTaskStatusName($project->company),
            'is_client_visible' => true,
        ]);
        $this->notifications->clientTaskCreated($task, $user);

        return $task->fresh(['project:id,name', 'statusColumn']);
    }

    /**
     * Клиент меняет приоритет и один раз ставит дедлайн, если сотрудники его не задали.
     *
     * @param  array{priority?: string|null, deadline?: string|null}  $data
     */
    public function updateTask(User $user, Task $task, array $data): Task
    {
        $this->assertTaskAccess($user, $task);
        $task->loadMissing(['assignees', 'statusColumn', 'project']);
        $this->assertProjectWritable($task->project);

        if ($task->statusColumn?->is_final) {
            abort(409, 'Задача уже завершена.');
        }
        if (array_key_exists('deadline', $data) && $task->deadline !== null) {
            throw ValidationException::withMessages([
                'deadline' => ['Дедлайн уже установлен.'],
            ]);
        }

        $oldTask = clone $task;
        $oldAssigneeNames = $task->assignees
            ->map(static fn (User $assignee): string => trim($assignee->name.' '.$assignee->last_name))
            ->all();
        $oldAssigneeIds = $task->assignees->pluck('id')->map(static fn ($id): string => (string) $id)->all();
        $task->update($data);
        $this->activity->update($oldTask, $task, $oldAssigneeNames);
        $this->notifications->taskUpdated($oldTask, $task, $oldAssigneeIds, $user);

        return $task->fresh(['project:id,name', 'statusColumn']);
    }

    /**
     * Документы проекта, открытого клиенту, кроме скрытых от него. Клиент может только смотреть и скачивать их.
     *
     * @return Collection<int, ProjectDocument>
     */
    public function documents(User $user, Project $project): Collection
    {
        $this->assertProjectAccess($user, $project);

        return ProjectDocument::query()
            ->where('project_id', $project->id)
            ->where('is_client_visible', true)
            ->with('uploader:id,name,last_name')
            ->latest()
            ->get();
    }

    public function assertDocumentAccess(User $user, ProjectDocument $document): void
    {
        abort_unless($document->is_client_visible, 404);
        abort_unless($this->projectsQuery($user)->whereKey($document->project_id)->exists(), 404);
    }

    /**
     * Задачи, у которых в указанный период менялся статус, с последним статусом внутри периода.
     * Задача могла пройти несколько статусов за период — берётся последний из них.
     * Создание задачи в периоде считается получением начального статуса.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function tasksReport(
        User $user,
        CarbonImmutable $from,
        CarbonImmutable $to,
        ?string $projectId = null,
        ?string $statusColumnId = null,
    ): Collection {
        $taskMorphClass = (new Task)->getMorphClass();
        $visibleTasks = $this->visibleTasksQuery($user)
            ->when($projectId, fn (Builder $query) => $query->where('project_id', $projectId));

        $statusChanges = DB::table('activity_log as log')
            ->where('log.subject_type', $taskMorphClass)
            ->where('log.event', 'status_updated')
            ->whereBetween('log.created_at', [$from, $to])
            ->whereIn(DB::raw('log.subject_id::text'), (clone $visibleTasks)->selectRaw('tasks.id::text'))
            ->selectRaw("log.subject_id::text as task_id, log.attribute_changes->'attributes'->>'task_status_column_id' as column_id, log.created_at as status_at, 1 as priority");

        // Начальный статус — «старый» статус первого перевода; если переводов не было, статус не менялся.
        $initialStatus = DB::table('activity_log as first_log')
            ->selectRaw("first_log.attribute_changes->'old'->>'task_status_column_id'")
            ->where('first_log.subject_type', $taskMorphClass)
            ->where('first_log.event', 'status_updated')
            ->whereRaw('first_log.subject_id::text = tasks.id::text')
            ->orderBy('first_log.created_at')
            ->limit(1);
        $creations = (clone $visibleTasks)
            ->whereBetween('tasks.created_at', [$from, $to])
            ->selectRaw('tasks.id::text as task_id')
            ->selectRaw("COALESCE(({$initialStatus->toSql()}), tasks.task_status_column_id::text) as column_id", $initialStatus->getBindings())
            ->selectRaw('tasks.created_at as status_at, 0 as priority')
            ->toBase();

        // При совпадении времени перевод статуса важнее создания.
        $lastStatuses = DB::query()
            ->fromSub($statusChanges->unionAll($creations), 'events')
            ->selectRaw('DISTINCT ON (events.task_id) events.task_id, events.column_id, events.status_at')
            ->orderBy('events.task_id')
            ->orderByDesc('events.status_at')
            ->orderByDesc('events.priority');

        $tasks = Task::query()
            ->joinSub($lastStatuses, 'period_status', function ($join): void {
                $join->on('period_status.task_id', '=', DB::raw('tasks.id::text'));
            })
            ->leftJoin('task_status_columns as period_column', function ($join): void {
                $join->on(DB::raw('period_column.id::text'), '=', 'period_status.column_id');
            })
            ->when($statusColumnId, fn (Builder $query) => $query->where('period_status.column_id', $statusColumnId))
            ->select('tasks.*')
            ->selectRaw('period_status.status_at as status_changed_at, period_status.column_id as period_column_id, period_column.name as period_column_name, period_column.is_final as period_column_is_final')
            ->with(['project:id,name', 'statusColumn'])
            ->orderByDesc('status_changed_at')
            ->get();

        $payloads = $this->taskPayloads($user, $tasks)->keyBy('id');

        // Статус в строке отчёта — последний за период, а не текущий.
        return $tasks->map(fn (Task $task): array => [
            ...$payloads[(string) $task->id],
            'status' => $task->getAttribute('period_column_name'),
            'status_column_id' => $task->getAttribute('period_column_id'),
            'is_final' => (bool) $task->getAttribute('period_column_is_final'),
            'status_changed_at' => CarbonImmutable::parse($task->getAttribute('status_changed_at'))->toISOString(),
        ])->values();
    }

    /**
     * @param  array<int, string>  $taskIds
     * @return Collection<string, int>
     */
    private function spentSeconds(array $taskIds): Collection
    {
        if ($taskIds === []) {
            return collect();
        }

        return DB::table('work_segments as seg')
            ->whereIn('seg.task_id', $taskIds)
            ->groupBy('seg.task_id')
            ->selectRaw('seg.task_id, COALESCE(SUM(seg.ended_at - seg.started_at), 0) as spent_seconds')
            ->pluck('spent_seconds', 'task_id')
            ->mapWithKeys(static fn ($seconds, $taskId): array => [(string) $taskId => (int) $seconds]);
    }

    private function clientDescription(Task $task): ?string
    {
        $description = $task->description;
        if (! is_string($description) || $description === '') {
            return $description;
        }

        return preg_replace_callback(
            '#(?:https?://[^"\'\s]+)?/(?:api/)?task-description-images/([0-9a-fA-F-]{36})#',
            fn (array $match): string => route('api.client.task-description-image', [$task->id, $match[1]]),
            $description,
        ) ?? $description;
    }
}
