<?php

namespace App\Models\Concerns;

use App\Enums\UserPermission;
use App\Models\Project;
use Illuminate\Support\Collection;

trait HasCompanyProjectAccess
{
    public function hasCompanyAccess(string $companyId): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $companyId !== '' && (string) $this->company_id === $companyId;
    }

    public function canViewAllProjects(): bool
    {
        return $this->can(UserPermission::PROJECTS_VIEW_ALL->value);
    }

    public function canViewAssignedProjects(): bool
    {
        return $this->can(UserPermission::PROJECTS_VIEW_ASSIGNED->value);
    }

    public function assignedProjectIds(): Collection
    {
        return $this->projectMembers()
            ->pluck('project_id')
            ->values();
    }

    public function isAssignedToProject(Project $project): bool
    {
        return $this->projectMembers()
            ->where('project_id', $project->id)
            ->exists();
    }

    public function canAccessProject(Project $project): bool
    {
        if (! $this->hasCompanyAccess((string) $project->company_id)) {
            return false;
        }

        if ($this->canViewAllProjects()) {
            return true;
        }

        if (! $this->canViewAssignedProjects()) {
            return false;
        }

        return $this->isAssignedToProject($project);
    }

    public function canAccessAssignedProject(Project $project): bool
    {
        if (! $this->hasCompanyAccess((string) $project->company_id)) {
            return false;
        }

        return $this->canViewAllProjects() || $this->isAssignedToProject($project);
    }

    public function canPerformProjectAction(Project $project, string $permission): bool
    {
        if (! $this->can($permission)) {
            return false;
        }

        return $this->canAccessAssignedProject($project);
    }
}
