<?php

namespace App\Services\Workspace;

use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class PinnedProjectService
{
    public function list(User $user): Collection
    {
        if (
            ! $user->can(UserPermission::PROJECTS_VIEW_ALL->value)
            && ! $user->can(UserPermission::PROJECTS_VIEW_ASSIGNED->value)
        ) {
            return collect();
        }

        $query = $user->pinnedProjects()
            ->orderByPivot('created_at', 'desc')
            ->orderBy('projects.name');

        if (! $user->isSuperAdmin()) {
            $query->where('projects.company_id', $user->company_id);
        }

        if (! $user->can(UserPermission::PROJECTS_VIEW_ALL->value)) {
            $query->whereHas('members', static function ($members) use ($user): void {
                $members->where('user_id', $user->id);
            });
        }

        return $query->get();
    }

    public function pin(User $user, Project $project): Project
    {
        $this->assertProjectCanBePinned($user, $project);

        $user->pinnedProjects()->syncWithoutDetaching([$project->id]);

        return $user->pinnedProjects()
            ->where('projects.id', $project->id)
            ->firstOrFail();
    }

    public function unpin(User $user, Project $project): void
    {
        $user->pinnedProjects()->detach($project->id);
    }

    private function assertProjectCanBePinned(User $user, Project $project): void
    {
        if ($user->isSuperAdmin()) {
            return;
        }

        if (! $user->canAccessProject($project)) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя закрепить проект, к которому нет доступа.'],
            ]);
        }

        if ( $project->status === ProjectStatus::ARCHIVED) {
            throw ValidationException::withMessages([
                'project_id' => ['Нельзя закрепить архивный проект.'],
            ]);
        }
    }
}
