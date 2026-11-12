<?php

namespace App\Services\Workspace;

use App\Enums\Currency;
use App\Enums\ProjectManagerPaymentMethod;
use App\Enums\ProjectPayrollExclusionScope;
use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectRate;
use App\Models\Task;
use App\Models\TaskAttachment;
use App\Models\TaskCommentAttachment;
use App\Models\TaskDescriptionImage;
use App\Models\TaskStatusColumn;
use App\Models\Template;
use App\Models\User;
use App\Repositories\Workspace\ProjectRepository;
use App\Repositories\Workspace\Reports\TimeReportRepository;
use App\Repositories\Workspace\TaskRepository;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use App\Support\CurrentDay;
use Carbon\Carbon;
use App\Support\CurrentWeek;
use App\Support\TaskVisibility;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectService
{
    private const TASK_DESCRIPTION_IMAGES_DISK = 'task_description_images';

    private const DEFAULT_TRACKER_STATUS_NAME = 'В работе';

    public function __construct(
        private readonly ProjectRepository $projectRepository,
        private readonly TaskRepository $taskRepository,
        private readonly TaskActivityService $taskActivityService,
        private readonly TimeReportRepository $timeReports,
        private readonly ProjectTaskStatusColumnService $projectTaskStatusColumnService,
        private readonly FinanceAnalyticsCacheService $financeAnalyticsCache,
        private readonly ProjectActivityHistoryService $activityHistory,
        private readonly TaskNotificationService $notifications,
    ) {}

    public function all(User $user, array $data, string $companyId): LengthAwarePaginator|Collection
    {
        $result = $user->canViewAllProjects()
            ? $this->projectRepository->paginate($companyId, $data)
            : $this->projectRepository->paginateForUser($user, $data);
        $projects = $result instanceof LengthAwarePaginator
            ? $result->getCollection()
            : $result;

        $projectIds = $projects
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();

        [$weekFrom, $weekTo] = CurrentWeek::bounds($companyId);
        $rows = $this->timeReports->own(
            $companyId,
            $weekFrom,
            $weekTo,
            'project',
            $projectIds,
        );

        [$dayFrom, $dayTo] = CurrentDay::bounds($companyId);
        $dailySecondsByProject = $this->timeReports->own(
            $companyId,
            $dayFrom,
            $dayTo,
            'project',
            $projectIds,
        )->keyBy('project_id');

        $totalRows = $this->timeReports->own(
            $companyId,
            null,
            null,
            'project',
            $projectIds,
        );
        $totalSecondsByProject = $totalRows->keyBy('project_id');

        $weeklySecondsByProject = $rows->keyBy('project_id');
        $ratesByProject = ProjectRate::currentForProjects($projectIds, Company::todayFor((string) $companyId));

        $projects->transform(function ($project) use ($weeklySecondsByProject, $dailySecondsByProject, $totalSecondsByProject, $ratesByProject) {
            $project->weekly_seconds = (int) ($weeklySecondsByProject[$project->id]->duration_seconds ?? 0);
            $project->daily_seconds = (int) ($dailySecondsByProject[$project->id]->duration_seconds ?? 0);

            $project->total_seconds = (int) ($totalSecondsByProject[$project->id]->duration_seconds ?? 0);

            $rate = $ratesByProject[(string) $project->id] ?? null;
            $rateAmount = $rate?->rate;
            $project->weekly_amount = $rateAmount !== null
                ? (int) round($project->weekly_seconds * $rateAmount / 3600)
                : 0;
            $project->current_rate = $rate;

            return $project;
        });

        if ($result instanceof LengthAwarePaginator) {
            $result->setCollection($projects);
        }

        return $result;
    }

    public function create(User $admin, array $data): Project
    {
        $project = DB::transaction(function () use ($admin, $data): Project {
            $project = $this->projectRepository->create([
                'id' => (string) Str::uuid(),
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? ProjectStatus::ACTIVE->value,
                'created_by_id' => $admin->id,
                'company_id' => $admin->company_id,
                'client_id' => $data['client_id'] ?? null,
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
                'budget' => $data['budget'] ?? null,
                'manager_payment_method' => $data['manager_payment_method']
                    ?? ProjectManagerPaymentMethod::ACCRUE_ALL->value,
                'is_internal' => (bool) ($data['is_internal'] ?? false),
                'exclude_from_payroll' => (bool) ($data['exclude_from_payroll'] ?? false),
                'payroll_exclusion_scope' => $data['payroll_exclusion_scope']
                    ?? ProjectPayrollExclusionScope::ALL->value,
            ]);
            $this->activityHistory->createInitialPeriod($project);

            $this->syncPayrollExcludedEmployees($project, $data);
            $this->createInitialRate($admin, $project, $data);

            $statusColumns = $data['task_status_columns'] ?? null;

            if (is_array($statusColumns)) {
                $this->projectTaskStatusColumnService->createFromDefinitions($project, $statusColumns);
            } else {
                $this->projectTaskStatusColumnService->createDefaults($project);
            }

            return $project->fresh()->load([
                'client',
                'members.user',
                'payrollExcludedEmployees',
                'tags',
                'taskStatusColumns',
                'company',
            ]);
        });

        $this->financeAnalyticsCache->invalidateCompany((string) $admin->company_id);

        return $project;
    }

    /**
     * Ставка из формы создания проекта действует с сегодняшнего дня компании.
     */
    private function createInitialRate(User $admin, Project $project, array $data): void
    {
        if (($data['rate'] ?? null) === null) {
            return;
        }

        ProjectRate::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'rate' => (int) $data['rate'],
            'vat' => $data['rate_vat'] ?? null,
            'currency' => $data['rate_currency'] ?? Currency::RUB->value,
            'effective_from' => Company::todayFor((string) $project->company_id),
            'changed_by' => $admin->id,
        ]);
    }

    public function update(Project $project, array $data): Project
    {
        $previousStatus = $project->status instanceof ProjectStatus
            ? $project->status
            : ProjectStatus::from((string) $project->status);
        $attributes = [
            'name' => trim($data['name']),
            'description' => $data['description'] ?? null,
            'status' => $data['status'],
            'client_id' => $data['client_id'] ?? null,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'budget' => $data['budget'] ?? null,
        ];

        if (array_key_exists('manager_payment_method', $data)) {
            $attributes['manager_payment_method'] = $data['manager_payment_method'];
        }

        if (array_key_exists('is_internal', $data)) {
            $attributes['is_internal'] = (bool) $data['is_internal'];
        }

        if (array_key_exists('exclude_from_payroll', $data)) {
            $attributes['exclude_from_payroll'] = (bool) $data['exclude_from_payroll'];
        }

        if (array_key_exists('payroll_exclusion_scope', $data)) {
            $attributes['payroll_exclusion_scope'] = $data['payroll_exclusion_scope'];
        }

        if (array_key_exists('weekly_limit_seconds', $data)) {
            $attributes['weekly_limit_seconds'] = $data['weekly_limit_seconds'];
        }

        $updatedProject = DB::transaction(function () use ($project, $attributes, $data, $previousStatus): Project {
            $updatedProject = $this->projectRepository->update($project, $attributes);
            $this->activityHistory->syncStatus($updatedProject, $previousStatus);
            $this->syncPayrollExcludedEmployees($updatedProject, $data);

            return $updatedProject->fresh()->load([
                'client',
                'members.user',
                'payrollExcludedEmployees',
                'tags',
                'taskStatusColumns',
                'company',
            ]);
        });

        $this->financeAnalyticsCache->invalidateCompany((string) $project->company_id);

        return $updatedProject;
    }

    public function changeCreator(Project $project, string $creatorId): Project
    {
        $creator = User::withBlocked()->findOrFail($creatorId);

        if ((string) $creator->company_id !== (string) $project->company_id) {
            throw ValidationException::withMessages([
                'created_by_id' => ['Создатель должен быть сотрудником компании проекта.'],
            ]);
        }

        if ($creator->isBlocked()) {
            throw ValidationException::withMessages([
                'created_by_id' => ['Нельзя назначить создателем проекта сотрудника из архива.'],
            ]);
        }

        return $this->projectRepository->update($project, [
            'created_by_id' => $creator->id,
        ]);
    }

    public function delete(Project $project): void
    {
        if ($project->status !== ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project' => ['Удалять можно только проекты из архива.'],
            ]);
        }

        $totalSeconds = $this->projectRepository->totalSeconds($project);

        if ($totalSeconds > 0) {
            throw ValidationException::withMessages([
                'project' => ['Нельзя удалить проект, потому что в нём есть учтённое время.'],
            ]);
        }

        $companyId = (string) $project->company_id;

        DB::transaction(function () use ($project): void {
            $this->projectRepository->delete($project);
        });

        $this->financeAnalyticsCache->invalidateCompany($companyId);
    }

    public function details(Project $project): array
    {
        $project = $this->projectRepository->loadWithMembers($project);
        [$weekFrom, $weekTo] = CurrentWeek::bounds((string) $project->company_id);
        $weeklyReport = $this->timeReports->own(
            (string) $project->company_id,
            $weekFrom,
            $weekTo,
            'project',
            [(string) $project->id],
        );

        $project->weekly_seconds = (int) ($weeklyReport->first()?->duration_seconds ?? 0);
        [$dayFrom, $dayTo] = CurrentDay::bounds((string) $project->company_id);
        $project->daily_seconds = (int) ($this->timeReports->own(
            (string) $project->company_id,
            $dayFrom,
            $dayTo,
            'project',
            [(string) $project->id],
        )->first()?->duration_seconds ?? 0);
        $project->total_seconds = $this->projectRepository->totalSeconds($project);
        // Как в списке проектов: без ставки карточка затирала бы её у проекта из списка.
        $rates = ProjectRate::currentForProjects([(string) $project->id], Company::todayFor((string) $project->company_id));
        $rate = $rates[(string) $project->id] ?? null;
        $project->current_rate = $rate;
        $project->weekly_amount = $rate?->rate !== null
            ? (int) round($project->weekly_seconds * $rate->rate / 3600)
            : 0;

        return [
            'project' => $project,
            'by_employee' => $this->projectRepository->durationByEmployee($project),
        ];
    }

    public function assignMember(
        Project $project,
        string $userId,
        bool $isPm = false,
        bool $isPmPayrollEnabled = true,
    ): Project {
        $employee = User::withBlocked()->findOrFail($userId);

        if ((string) $employee->company_id !== (string) $project->company_id) {
            throw ValidationException::withMessages([
                'user_id' => ['Сотрудник не принадлежит компании проекта.'],
            ]);
        }

        if ($employee->isBlocked()) {
            throw ValidationException::withMessages([
                'user_id' => ['Нельзя назначить архивированного сотрудника.'],
            ]);
        }

        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя назначить сотрудника на архивированный проект.'],
            ]);
        }

        $project = $this->projectRepository->addMember(
            $project,
            $employee,
            (string) Str::uuid(),
            $isPm,
            $isPmPayrollEnabled,
        );

        $this->financeAnalyticsCache->invalidateCompany((string) $project->company_id);

        return $project;
    }

    public function removeMember(Project $project, User $employee): Project
    {
        $project = $this->projectRepository->removeMember($project, $employee);

        $this->financeAnalyticsCache->invalidateCompany((string) $project->company_id);

        return $project;
    }

    public function tasks(User $user, Project $project): Collection
    {
        if (
            $user->can(UserPermission::TASKS_VIEW_ALL->value)
            || $user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)
        ) {
            return $this->taskRepository->tasks($project);
        }

        if ($user->can(UserPermission::TASKS_VIEW_ASSIGNED->value)) {
            return $this->taskRepository->tasksForUser($project, $user, includeCreated: true);
        }

        return collect();
    }

    public function userTasks(Project $project, User $user): Collection
    {
        return $this->taskRepository->tasksForUser($project, $user);
    }

    public function taskBoardColumns(Project $project): Collection
    {
        return $this->taskRepository->taskStatusColumns($project);
    }

    public function task(User $user, Project $project, Task $task): Task
    {
        $this->assertTaskBelongsToProject($project, $task);

        $boardTask = $this->taskRepository->task($project, $task);

        if (
            $user->can(UserPermission::TASKS_VIEW_ALL->value)
            || $user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)
        ) {
            return $boardTask;
        }

        if ($user->can(UserPermission::TASKS_VIEW_ASSIGNED->value)) {
            if ($this->isTaskVisibleByAssignedTree($project, $task, $user)) {
                return $boardTask;
            }
        }

        throw new NotFoundHttpException;
    }

    private function isTaskVisibleByAssignedTree(Project $project, Task $task, User $user): bool
    {
        return TaskVisibility::isVisibleByAssignedTree(
            $task,
            (string) $project->id,
            (string) $user->id,
        );
    }

    public function createTask(User $creator, Project $project, array $data): Task
    {
        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя создавать задачи в архивированном проекте.'],
            ]);
        }

        $assigneeIds = $this->normalizeAndValidateAssignees($project, $data['assignee_ids'] ?? []);
        $this->assertStartNotAfterDeadline($data['start_at'] ?? null, $data['deadline'] ?? null);

        $task = $this->taskRepository->createTask(
            $project,
            [
                'id' => (string) Str::uuid(),
                'title' => trim((string) ($data['title'] ?? '')),
                'parent_task_id' => $this->resolveParentTaskId($project, $data),
                'created_by_id' => $creator->id,
                'is_draft' => true,
                'published_at' => null,
                'description' => $data['description'] ?? null,
                'priority' => $data['priority'] ?? null,
                'estimation' => $data['estimation'] ?? null,
                'deadline' => $data['deadline'] ?? null,
                'start_at' => $data['start_at'] ?? null,
                'is_client_visible' => (bool) ($data['is_client_visible'] ?? true),
                'client_approval_status' => 'pending',
                // status_name задаёт статус по имени; если в проекте его нет, задача создаётся без статуса.
                'task_status_column_id' => array_key_exists('status_name', $data)
                    ? $this->statusColumnIdByName($project, (string) $data['status_name'])
                    : $this->resolveDefaultTaskStatusColumnId($project, $data['status_column_id'] ?? null),
            ],
            $assigneeIds,
        );

        if (! $task->is_draft) {
            $this->taskActivityService->create(
                $task,
                $task->assignees->pluck('id')->map(fn ($id) => (string) $id)->all(),
            );
            $this->notifications->taskPublished($task, $creator);
        }

        return $task;
    }

    public function updateTask(Project $project, Task $task, array $data): Task
    {
        if ($task->project_id !== $project->id) {
            throw ValidationException::withMessages([
                'task_id' => ['Задача не принадлежит выбранному проекту.'],
            ]);
        }

        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя редактировать задачи в архивированном проекте.'],
            ]);
        }

        $assigneeIds = $this->normalizeAndValidateAssignees(
            $project,
            $data['assignee_ids'] ?? $task->assignees->pluck('id')->map(fn ($id) => (string) $id)->all()
        );

        $oldAssigneeNames = $task->assignees->map(function ($user) {
            return trim($user->name.' '.$user->last_name);
        })->all();
        $oldAssigneeIds = $task->assignees->pluck('id')->map(fn ($id) => (string) $id)->all();

        $oldTask = clone $task;

        $wasDraft = $task->is_draft;

        $this->assertStartNotAfterDeadline(
            array_key_exists('start_at', $data) ? $data['start_at'] : $task->start_at,
            array_key_exists('deadline', $data) ? $data['deadline'] : $task->deadline,
        );

        $updatedTask = $this->taskRepository->updateTask(
            $task,
            [
                'title' => array_key_exists('title', $data)
                    ? trim((string) ($data['title'] ?? ''))
                    : $task->title,
                'parent_task_id' => $this->resolveParentTaskId($project, $data, $task),
                'description' => array_key_exists('description', $data) ? $data['description'] : $task->description,
                'priority' => array_key_exists('priority', $data) ? $data['priority'] : $task->priority,
                'estimation' => array_key_exists('estimation', $data) ? $data['estimation'] : $task->estimation,

                // Сделал через проверку, пришел ли вообще такой ключ, потому что при сбросе
                // дедлайн должен обращаться в null.
                // И если оставить туже логику, как к примеру для estimation
                // то дедлайн не перезапишется и останется таким как был до сброса
                // Как я понял
                'deadline' => array_key_exists('deadline', $data) ? $data['deadline'] : $task->deadline,
                'start_at' => array_key_exists('start_at', $data) ? $data['start_at'] : $task->start_at,
                'is_client_visible' => array_key_exists('is_client_visible', $data)
                    ? (bool) $data['is_client_visible']
                    : (bool) $task->is_client_visible,
            ],
            $assigneeIds,
        );

        if ($wasDraft && ! $updatedTask->is_draft) {
            $this->taskActivityService->create(
                $updatedTask,
                $updatedTask->assignees->pluck('id')->map(fn ($id) => (string) $id)->all(),
            );
            $this->notifications->taskPublished($updatedTask);
        } elseif (! $wasDraft && ! $updatedTask->is_draft) {
            $this->taskActivityService->update(
                $oldTask,
                $updatedTask,
                $oldAssigneeNames,
            );
            $this->notifications->taskUpdated($oldTask, $updatedTask, $oldAssigneeIds);
        } elseif (! $wasDraft && $updatedTask->is_draft) {
            // Удаляем публичную ссылку, если задача стала черновиком
            $updatedTask->publicLinks()->delete();
        }

        // Возвращаем задачу через тот же запрос, что используется при её получении.
        // Он загружает связи и вычисляет агрегированные поля, включая spent_seconds.
        return $this->taskRepository->task($project, $updatedTask);
    }

    public function deleteTask(Project $project, Task $task): void
    {
        $this->assertTaskBelongsToProject($project, $task);

        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя удалять задачи в архивированном проекте.'],
            ]);
        }

        if ($task->workSegments()->exists()) {
            throw ValidationException::withMessages([
                'task_id' => ['По задаче уже есть затреканное время. Перенесите его в другую задачу, затем удалите задачу.'],
            ]);
        }

        $descriptionImages = TaskDescriptionImage::query()
            ->where('task_id', $task->id)
            ->get(['disk', 'path']);
        $attachmentPaths = TaskAttachment::query()
            ->where('task_id', $task->id)
            ->pluck('path');
        $commentAttachmentPaths = TaskCommentAttachment::query()
            ->where('task_id', $task->id)
            ->pluck('path');

        $this->taskRepository->deleteTask($task);

        foreach ($descriptionImages as $image) {
            Storage::disk($image->disk)->delete($image->path);
        }
        foreach ($attachmentPaths->merge($commentAttachmentPaths) as $path) {
            Storage::disk('local')->delete($path);
        }
    }

    public function moveTask(Project $project, Task $task, array $data): Task
    {
        if ($task->project_id !== $project->id) {
            throw ValidationException::withMessages([
                'task_id' => ['Задача не принадлежит выбранному проекту.'],
            ]);
        }

        $oldColumnId = $task->task_status_column_id;
        $wasDraft = $task->is_draft;

        $movedTask = $this->taskRepository->moveTask(
            $project,
            $task,
            (string) $data['status_column_id'],
            (int) $data['destination_index'],
        );

        if (! $wasDraft) {
            $this->taskActivityService->move($movedTask, $oldColumnId);
            $this->notifications->statusChanged($movedTask, $oldColumnId !== null ? (string) $oldColumnId : null);
        }

        if ($movedTask->statusColumn?->is_final) {
            $movedTask->publicLinks()->delete();
        }

        return $movedTask;
    }

    public function storeTaskDescriptionImage(
        User $user,
        Project $project,
        Task $task,
        UploadedFile $file,
    ): TaskDescriptionImage {
        $this->assertTaskBelongsToProject($project, $task);

        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя редактировать задачи в архивированном проекте.'],
            ]);
        }

        return $this->saveTaskDescriptionImage($project, $task, $file, (string) $user->id);
    }

    /**
     * Сохраняет картинку описания задачи без проверок доступа, для служебных команд.
     */
    public function saveTaskDescriptionImage(
        Project $project,
        Task $task,
        UploadedFile $file,
        ?string $uploadedBy,
    ): TaskDescriptionImage {
        $storedPath = null;

        DB::beginTransaction();

        try {
            $storedPath = $this->storeTaskDescriptionImageFile($project, $task, $file);

            $image = TaskDescriptionImage::create([
                'id' => (string) Str::uuid(),
                'company_id' => $project->company_id,
                'task_id' => $task->id,
                'disk' => self::TASK_DESCRIPTION_IMAGES_DISK,
                'path' => $storedPath,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => (int) ($file->getSize() ?: 0),
                'uploaded_by' => $uploadedBy,
            ]);

            DB::commit();

            return $image;
        } catch (\Throwable $e) {
            DB::rollBack();

            if (is_string($storedPath) && $storedPath !== '') {
                Storage::disk(self::TASK_DESCRIPTION_IMAGES_DISK)->delete($storedPath);
            }

            throw $e;
        }
    }

    public function openTaskDescriptionImage(User $user, TaskDescriptionImage $image): StreamedResponse
    {
        $image->loadMissing(['task.project']);

        if (! $image->task) {
            throw new NotFoundHttpException;
        }

        if (! Storage::disk($image->disk)->exists($image->path)) {
            throw new NotFoundHttpException;
        }

        return Storage::disk($image->disk)->response(
            $image->path,
            $image->original_name,
            [
                'Content-Type' => $image->mime_type ?: 'application/octet-stream',
                'Cache-Control' => 'private, max-age=3600',
            ]
        );
    }

    private function normalizeAndValidateAssignees(Project $project, array $rawAssigneeIds): array
    {
        $assigneeIds = collect($rawAssigneeIds)
            ->filter(static fn (mixed $value): bool => is_string($value) && trim($value) !== '')
            ->map(static fn (string $value): string => trim($value))
            ->unique()
            ->intersect($this->taskRepository->projectMemberUserIds($project))
            ->values();

        return $assigneeIds->all();
    }

    private function assertStartNotAfterDeadline(mixed $startAt, mixed $deadline): void
    {
        if (blank($startAt) || blank($deadline)) {
            return;
        }

        if (Carbon::parse($startAt)->gt(Carbon::parse($deadline))) {
            throw ValidationException::withMessages([
                'start_at' => ['Старт выполнения не может быть позже дедлайна.'],
            ]);
        }
    }

    private function resolveParentTaskId(Project $project, array $data, ?Task $task = null): ?string
    {
        if (! array_key_exists('parent_task_id', $data)) {
            return $task ? (string) $task->parent_task_id ?: null : null;
        }

        $parentTaskId = $data['parent_task_id'];

        if ($parentTaskId === null || trim((string) $parentTaskId) === '') {
            return null;
        }

        return $this->validateParentTask($project, trim((string) $parentTaskId), $task);
    }

    private function validateParentTask(Project $project, string $parentTaskId, ?Task $task = null): string
    {
        $parentTask = Task::query()
            ->where('project_id', $project->id)
            ->where('id', $parentTaskId)
            ->first();

        if (! $parentTask) {
            throw ValidationException::withMessages([
                'parent_task_id' => ['Родительская задача не найдена в выбранном проекте.'],
            ]);
        }

        if ($task && (string) $task->id === (string) $parentTask->id) {
            throw ValidationException::withMessages([
                'parent_task_id' => ['Задача не может быть подзадачей самой себя.'],
            ]);
        }

        if ($task) {
            $ancestorId = (string) $parentTask->parent_task_id;

            while ($ancestorId !== '') {
                if ($ancestorId === (string) $task->id) {
                    throw ValidationException::withMessages([
                        'parent_task_id' => ['Нельзя назначить потомка родительской задачей (циклическая связь).'],
                    ]);
                }

                $ancestorId = (string) Task::query()
                    ->where('project_id', $project->id)
                    ->where('id', $ancestorId)
                    ->value('parent_task_id');
            }
        }

        return (string) $parentTask->id;
    }

    private function resolveDefaultTaskStatusColumnId(Project $project, mixed $requestedColumnId): ?string
    {
        $columnId = is_string($requestedColumnId) ? trim($requestedColumnId) : '';

        if ($columnId !== '') {
            $exists = $project->taskStatusColumns()
                ->where('id', $columnId)
                ->exists();

            if (! $exists) {
                throw ValidationException::withMessages([
                    'status_column_id' => ['Выбранный статус не принадлежит проекту.'],
                ]);
            }

            return $columnId;
        }

        $defaultStatusName = trim((string) ($project->company?->tracker_default_task_status_name ?? ''));
        if ($defaultStatusName === '') {
            $defaultStatusName = self::DEFAULT_TRACKER_STATUS_NAME;
        }

        return $this->statusColumnIdByName($project, $defaultStatusName);
    }

    private function statusColumnIdByName(Project $project, string $statusName): ?string
    {
        $column = $project->taskStatusColumns()
            ->whereRaw('LOWER(TRIM(name)) = ?', [mb_strtolower(trim($statusName))])
            ->orderBy('position')
            ->first();

        return $column ? (string) $column->id : null;
    }

    private function storeTaskDescriptionImageFile(Project $project, Task $task, UploadedFile $file): string
    {
        $safeName = $this->safeOriginalName($file);
        $fileName = (string) Str::uuid().'_'.$safeName;
        $directory = (string) $project->company_id.'/'.$project->id.'/'.$task->id;

        $storedPath = Storage::disk(self::TASK_DESCRIPTION_IMAGES_DISK)->putFileAs($directory, $file, $fileName);

        if (! is_string($storedPath) || $storedPath === '') {
            throw new \RuntimeException('Не удалось сохранить изображение описания задачи.');
        }

        return $storedPath;
    }

    private function safeOriginalName(UploadedFile $file): string
    {
        $original = $file->getClientOriginalName();
        $name = pathinfo($original, PATHINFO_FILENAME);
        $extension = strtolower((string) pathinfo($original, PATHINFO_EXTENSION));

        $safeBase = Str::slug($name);
        if ($safeBase === '') {
            $safeBase = 'image';
        }

        $safeBase = substr($safeBase, 0, 80);

        if ($extension === '') {
            return $safeBase;
        }

        return $safeBase.'.'.substr($extension, 0, 15);
    }

    private function assertTaskBelongsToProject(Project $project, Task $task): void
    {
        if ((string) $task->project_id !== (string) $project->id) {
            throw ValidationException::withMessages([
                'task_id' => ['Задача не принадлежит выбранному проекту.'],
            ]);
        }
    }

    private function syncPayrollExcludedEmployees(Project $project, array $data): void
    {
        $enabled = (bool) ($data['exclude_from_payroll'] ?? $project->exclude_from_payroll);
        $scope = $data['payroll_exclusion_scope']
            ?? $project->payroll_exclusion_scope?->value
            ?? ProjectPayrollExclusionScope::ALL->value;

        if (! $enabled || $scope === ProjectPayrollExclusionScope::ALL->value) {
            $this->projectRepository->syncPayrollExcludedEmployees($project, []);

            return;
        }

        if (array_key_exists('payroll_excluded_employee_ids', $data)) {
            $this->projectRepository->syncPayrollExcludedEmployees(
                $project,
                $data['payroll_excluded_employee_ids'],
            );
        }
    }

    public function createFromTemplate(User $user, Template $template, array $data): Project
    {
        if ((string) $user->company_id !== (string) $template->company_id) {
            throw ValidationException::withMessages([
                'template_id' => ['Шаблон не принадлежит компании пользователя.'],
            ]);
        }

        return DB::transaction(function () use ($user, $template, $data) {
            $project = $this->create($user, [
                'name' => trim($data['name']),
                'description' => $data['description'] ?? null,
                'status' => $data['status'] ?? ProjectStatus::ACTIVE->value,
                'client_id' => $data['client_id'] ?? null,
                'starts_at' => $data['starts_at'] ?? null,
                'ends_at' => $data['ends_at'] ?? null,
                'budget' => $data['budget'] ?? null,
                'rate' => $data['rate'] ?? null,
                'rate_currency' => $data['rate_currency'] ?? null,
                'rate_vat' => $data['rate_vat'] ?? null,
            ]);

            $template->loadMissing(['members', 'statusColumns']);

            foreach ($template->members as $member) {
                $this->assignMember($project, (string) $member->user_id);
            }

            if ($template->statusColumns->isNotEmpty()) {
                TaskStatusColumn::query()
                    ->where('project_id', $project->id)
                    ->delete();

                $this->projectTaskStatusColumnService->createFromDefinitions(
                    $project,
                    $template->statusColumns
                        ->map(static fn (object $column): array => [
                            'name' => $column->name,
                            'slug' => $column->slug,
                            'color' => $column->color,
                            'is_default' => (bool) $column->is_default,
                            'is_final' => (bool) $column->is_final,
                        ])
                        ->all(),
                );
            }

            return $project->fresh()->load(['client', 'members.user', 'tags', 'taskStatusColumns']);
        });
    }
}
