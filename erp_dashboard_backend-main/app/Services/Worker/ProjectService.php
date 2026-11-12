<?php

namespace App\Services\Worker;

use App\Enums\UserPermission;
use App\Models\User;
use App\Models\Project;
use App\Repositories\Workspace\ProjectRepository;
use App\Repositories\Workspace\TaskRepository;
use Illuminate\Support\Collection;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectService
{
    public function __construct(
        private readonly ProjectRepository $projectRepository,
        private readonly TaskRepository $taskRepository,
    ) {}

    public function all(User $user, array $data): Collection
    {
        return $this->projectRepository->allForUser(
            $user,
            $data['status'] ?? 'all',
            trim((string) ($data['search'] ?? '')),
        );
    }

    public function tasks(User $user, Project $project): Collection
    {
        if (! $this->projectRepository->userHasAccessToProject($user, $project)) {
            throw new NotFoundHttpException();
        }

        if (
            $user->can(UserPermission::TASKS_VIEW_ALL->value)
            || $user->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)
        ) {
            return $this->taskRepository->tasks($project);
        }

        if ($user->can(UserPermission::TASKS_VIEW_ASSIGNED->value)) {
            return $this->taskRepository->tasksForUser($project, $user, includeCreated: true);
        }

        throw new NotFoundHttpException();
    }

    public function tasksForUser(User $user, Project $project, string $targetUserId): Collection
    {
        if (! $this->projectRepository->userHasAccessToProject($user, $project)) {
            throw new NotFoundHttpException();
        }

        $targetUser = User::withBlocked()->findOrFail($targetUserId);

        if ((string) $targetUser->company_id !== (string) $user->company_id) {
            throw new NotFoundHttpException();
        }

        if (! $this->projectRepository->userHasAccessToProject($targetUser, $project)) {
            throw new NotFoundHttpException();
        }

        $isSelfRequest = (string) $user->id === (string) $targetUser->id;
        if (! $isSelfRequest && ! $user->can(UserPermission::TIME_ADD_FOR_OTHERS->value)) {
            throw new NotFoundHttpException();
        }

        return $this->taskRepository->tasksForUser($project, $targetUser, includeCreated: $isSelfRequest);
    }

    public function taskBoardColumns(Project $project): Collection
    {
        return $this->taskRepository->taskStatusColumns($project);
    }
}
