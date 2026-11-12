<?php

namespace App\Services\Workspace;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkSegment;
use App\Repositories\Workspace\TaskRepository;
use App\Repositories\Workspace\TimeEntryRepository;
use App\Services\Notifications\TaskNotificationService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TimeEntryService
{
    public function __construct(
        private readonly TimeEntryRepository $entries,
        private readonly ProjectTaskStatusColumnService $taskStatusColumns,
        private readonly FinanceAnalyticsCacheService $financeAnalyticsCache,
        private readonly TaskRepository $taskRepository,
        private readonly TaskNotificationService $notifications,
    ) {}

    public function create(array $data, string $createdBy, string $companyId): array
    {
        $startedAtTimestamp = (int) $data['started_at'];
        $endedAtTimestamp = (int) $data['ended_at'];
        $startedAt = Carbon::createFromTimestamp($startedAtTimestamp);
        $endedAt = Carbon::createFromTimestamp($endedAtTimestamp);
        $now = now();

        if ($startedAt->greaterThan($now)) {
            throw ValidationException::withMessages([
                'started_at' => ['Время начала не может быть позже текущей даты и времени.'],
            ]);
        }

        if ($endedAt->greaterThan($now)) {
            throw ValidationException::withMessages([
                'ended_at' => ['Время окончания не может быть позже текущей даты и времени.'],
            ]);
        }

        if ($endedAt->lessThanOrEqualTo($startedAt)) {
            throw ValidationException::withMessages([
                'ended_at' => ['Время окончания должно быть позже начала.'],
            ]);
        }

        $employee = User::withBlocked()->findOrFail($data['user_id']);
        if ((string) $employee->company_id !== $companyId) {
            throw ValidationException::withMessages([
                'user_id' => ['Сотрудник не принадлежит вашей компании.'],
            ]);
        }

        if ($employee->isBlocked()) {
            throw ValidationException::withMessages([
                'user_id' => ['Нельзя добавлять время архивированному сотруднику.'],
            ]);
        }

        $overlap = $this->entries->findOverlap($data['user_id'], $startedAtTimestamp, $endedAtTimestamp);
        if ($overlap) {
            return [
                'conflict' => true,
                'started_at' => (int) $overlap->started_at,
                'ended_at' => (int) $overlap->ended_at,
            ];
        }

        $task = null;
        $project = Project::query()
            ->where('id', $data['project_id'])
            ->where('company_id', $companyId)
            ->firstOrFail();

        if (! empty(($data['task_id']))) {
            $task = Task::findOrFail($data['task_id']);

            if ($task->is_draft) {
                throw ValidationException::withMessages([
                    'task_id' => ['Нельзя учитывать время по черновику задачи.'],
                ]);
            }

            if ($task->project_id !== $data['project_id']) {
                throw ValidationException::withMessages([
                    'task_id' => ['Задача не принадлежит выбранному проекту.'],
                ]);
            }

            if (! $task->assignees()->withBlocked()->where('user_id', $data['user_id'])->exists()) {
                throw ValidationException::withMessages([
                    'task_id' => ['Сотрудник не назначен на эту задачу.'],
                ]);
            }
        }

        if (! $task) {
            $taskTitle = trim((string) ($data['new_task_title'] ?? ''));
            $defaultColumn = $this->taskStatusColumns->defaultColumn($project);
            $nextPosition = $this->nextTaskPosition($project->id, (string) $defaultColumn->id);

            $task = $this->entries->firstOrCreateManualTask(
                $project->id,
                (string) Str::uuid(),
                $taskTitle,
                [
                    'task_status_column_id' => $defaultColumn->id,
                    'position' => $nextPosition,
                    'description' => null,
                ]
            );

            $task->assignees()->syncWithoutDetaching([$data['user_id']]);
        }

        $entry = $this->entries->create([
            'id' => (string) Str::uuid(),
            'task_id' => $task->id,
            'user_id' => $data['user_id'],
            'note' => $data['note'] ?? null,
            'created_by' => $createdBy,
            'started_at' => $startedAtTimestamp,
            'ended_at' => $endedAtTimestamp,
        ])->load(['user', 'task.project']);

        $this->financeAnalyticsCache->invalidateCompany($companyId);
        $this->notifications->timeAdded($entry);

        return [
            'conflict' => false,
            'entry' => $entry,
        ];
    }

    public function moveSegmentInterval(WorkSegment $segment, array $data, string $createdBy, string $companyId): array
    {
        $employee = User::withBlocked()->findOrFail($segment->user_id);

        if ($employee->isBlocked()) {
            throw ValidationException::withMessages([
                'segment' => ['Нельзя изменять время архивированного сотрудника.'],
            ]);
        }

        $segmentStartedAt = (int) $segment->started_at;
        $segmentEndedAt = (int) $segment->ended_at;
        $moveFrom = (int) $data['move_from'];
        $moveTo = (int) $data['move_to'];

        if ($moveTo <= $moveFrom) {
            throw ValidationException::withMessages([
                'move_to' => ['Конец переносимого интервала должен быть позже начала.'],
            ]);
        }

        if ($moveFrom < $segmentStartedAt || $moveTo > $segmentEndedAt) {
            throw ValidationException::withMessages([
                'move_from' => ['Переносимый интервал должен быть внутри исходного сегмента.'],
            ]);
        }

        $destinationTask = null;
        $destinationProject = Project::query()
            ->where('id', $data['destination_project_id'])
            ->where('company_id', $companyId)
            ->firstOrFail();

        if (! empty($data['destination_task_id'])) {
            $destinationTask = Task::findOrFail($data['destination_task_id']);

            if ($destinationTask->is_draft) {
                throw ValidationException::withMessages([
                    'destination_task_id' => ['Нельзя переносить время в черновик задачи.'],
                ]);
            }

            if ($destinationTask->project_id !== $destinationProject->id) {
                throw ValidationException::withMessages([
                    'destination_task_id' => ['Задача не принадлежит выбранному проекту.'],
                ]);
            }
        } else {
            $title = trim((string) ($data['new_task_title'] ?? ''));

            $defaultColumn = $this->taskStatusColumns->defaultColumn($destinationProject);
            $nextPosition = $this->nextTaskPosition($destinationProject->id, (string) $defaultColumn->id);

            if ($title === '') {
                throw ValidationException::withMessages([
                    'new_task_title' => ['Укажите название новой задачи или выберите существующую задачу.'],
                ]);
            }

            $destinationTask = Task::create([
                'id' => (string) Str::uuid(),
                'title' => $title,
                'project_id' => $destinationProject->id,
                'task_status_column_id' => $defaultColumn->id,
                'position' => $nextPosition,
                'description' => null,
            ]);
        }

        // Чтобы пользователь, чье время переносим, точно был назначен на задачу
        $destinationTask->assignees()->syncWithoutDetaching([$segment->user_id]);

        $basePayload = [
            'user_id' => $segment->user_id,
            'note' => $segment->note,
            'created_by' => $createdBy,
        ];

        $movedSegment = null;

        DB::transaction(function () use (
            $segment,
            $segmentStartedAt,
            $segmentEndedAt,
            $moveFrom,
            $moveTo,
            $destinationTask,
            $basePayload,
            &$movedSegment
        ): void {
            // 1) Левый остаток
            if ($segmentStartedAt < $moveFrom) {
                $this->entries->create([
                    'id' => (string) Str::uuid(),
                    'task_id' => $segment->task_id,
                    ...$basePayload,
                    'started_at' => $segmentStartedAt,
                    'ended_at' => $moveFrom,
                ]);
            }

            // 2) Перенесенная часть
            $movedSegment = $this->entries->create([
                'id' => (string) Str::uuid(),
                'task_id' => $destinationTask->id,
                ...$basePayload,
                'started_at' => $moveFrom,
                'ended_at' => $moveTo,
            ]);

            // 3) Правый остаток
            if ($moveTo < $segmentEndedAt) {
                $this->entries->create([
                    'id' => (string) Str::uuid(),
                    'task_id' => $segment->task_id,
                    ...$basePayload,
                    'started_at' => $moveTo,
                    'ended_at' => $segmentEndedAt,
                ]);
            }

            // Старый сегмент больше не нужен
            $segment->delete();
        });

        // В случае если это был единственный сегмент у задачи,
        // То в случае не заполнености основных полей (сотрудники, название)
        // Переводим в черновик
        $sourceTask = Task::find($segment->task_id);
        if ($sourceTask) {
            $this->taskRepository->updateDraftStatus($sourceTask);
        }

        $this->financeAnalyticsCache->invalidateCompany($companyId);
        $this->notifications->timeMoved($segment, $moveFrom, $moveTo, $destinationTask);

        return [
            'message' => 'Время успешно перенесено.',
            'moved_segment_id' => $movedSegment?->id,
            'destination_task_id' => $destinationTask->id,
        ];
    }

    public function deleteSegmentInterval(
        WorkSegment $segment,
        array $data,
        string $createdBy,
        string $companyId,
    ): array {
        $segmentStartedAt = (int) $segment->started_at;
        $segmentEndedAt = (int) $segment->ended_at;
        $deleteFrom = (int) $data['delete_from'];
        $deleteTo = (int) $data['delete_to'];

        if ($deleteTo <= $deleteFrom) {
            throw ValidationException::withMessages([
                'delete_to' => ['Конец удаляемого интервала должен быть позже начала.'],
            ]);
        }

        if ($deleteFrom < $segmentStartedAt || $deleteTo > $segmentEndedAt) {
            throw ValidationException::withMessages([
                'delete_from' => ['Удаляемый интервал должен быть внутри исходного сегмента.'],
            ]);
        }

        $basePayload = [
            'task_id' => $segment->task_id,
            'user_id' => $segment->user_id,
            'note' => $segment->note,
            'created_by' => $createdBy,
        ];

        DB::transaction(function () use (
            $segment,
            $segmentStartedAt,
            $segmentEndedAt,
            $deleteFrom,
            $deleteTo,
            $basePayload
        ): void {
            // Левый остаток
            if ($segmentStartedAt < $deleteFrom) {
                $this->entries->create([
                    'id' => (string) Str::uuid(),
                    ...$basePayload,
                    'started_at' => $segmentStartedAt,
                    'ended_at' => $deleteFrom,
                ]);
            }

            // Правый остаток
            if ($deleteTo < $segmentEndedAt) {
                $this->entries->create([
                    'id' => (string) Str::uuid(),
                    ...$basePayload,
                    'started_at' => $deleteTo,
                    'ended_at' => $segmentEndedAt,
                ]);
            }

            // Исходный сегмент удаляем целиком
            $segment->delete();
        });

        // В случае если это был единственный сегмент у задачи,
        // То в случае не заполнености основных полей (сотрудники, название)
        // Переводим в черновик
        $sourceTask = Task::find($segment->task_id);
        if ($sourceTask) {
            $this->taskRepository->updateDraftStatus($sourceTask);
        }

        $this->financeAnalyticsCache->invalidateCompany($companyId);
        $this->notifications->timeDeleted($segment, $deleteFrom, $deleteTo);

        return [
            'message' => 'Выбранный интервал времени успешно удален.',
        ];
    }

    private function nextTaskPosition(string $projectId, string $columnId): int
    {
        return (int) Task::query()
            ->where('project_id', $projectId)
            ->where('task_status_column_id', $columnId)
            ->max('position') + 1;
    }
}
