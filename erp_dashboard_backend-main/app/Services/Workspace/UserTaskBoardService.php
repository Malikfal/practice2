<?php

namespace App\Services\Workspace;

use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Models\Task;
use App\Models\TaskStatusColumn;
use App\Models\User;
use App\Repositories\Workspace\TaskRepository;
use Illuminate\Validation\ValidationException;

class UserTaskBoardService
{
    public function __construct(
        private readonly TaskRepository $taskRepository,
        private readonly ProjectService $projects,
    ) {}

    public function board(User $user, array $filters): array
    {
        return [
            'columns' => $this->taskRepository->visibleStatusColumns($user),
            'data' => $this->taskRepository->userBoardTasks($user, $filters),
        ];
    }

    public function move(User $user, Task $task, array $data): Task
    {
        $task->loadMissing('project');

        $this->assertCanMoveTask($user, $task);

        $targetColumn = $this->resolveTargetColumn(
            $task,
            (string) $data['status_slug'],
        );

        // Тот же путь, что и на доске проекта: история статуса, уведомления, отключение ссылки в финальном статусе.
        return $this->projects->moveTask($task->project, $task, [
            'status_column_id' => (string) $targetColumn->id,
            'destination_index' => (int) $data['destination_index'],
        ]);
    }

    private function assertCanMoveTask(User $user, Task $task): void
    {
        $project = $task->project;

        if (! $project || (string) $project->company_id !== (string) $user->company_id) {
            abort(404);
        }

        if ($project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя перемещать задачи в архивированном проекте.'],
            ]);
        }

        if (! $user->canPerformProjectAction($project, UserPermission::TASKS_MOVE->value)) {
            abort(403);
        }
    }

    private function resolveTargetColumn(Task $task, string $statusSlug): TaskStatusColumn
    {
        $targetColumn = $this->taskRepository->statusColumnBySlug($task, $statusSlug);

        if (! $targetColumn) {
            throw ValidationException::withMessages([
                'status_slug' => ['Колонка статуса не найдена в проекте задачи.'],
            ]);
        }

        return $targetColumn;
    }
}
