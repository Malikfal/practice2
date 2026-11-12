<?php

namespace App\Models\Concerns;

use App\Enums\UserPermission;

trait HasTaskProjectVisibility
{
    /**
     * @return array<int, string>|null
     */
    public function visibleTaskProjectIds(): ?array
    {
        if ($this->can(UserPermission::TASKS_VIEW_ALL->value)) {
            return null;
        }

        if ($this->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)) {
            return $this->assignedProjectIds()
                ->map(static fn (mixed $id): string => (string) $id)
                ->values()
                ->all();
        }

        return [];
    }

    public function shouldRestrictTasksToOwnAssignments(): bool
    {
        if ($this->can(UserPermission::TASKS_VIEW_ALL->value)) {
            return false;
        }

        if ($this->can(UserPermission::TASKS_VIEW_PROJECT_ASSIGNED->value)) {
            return false;
        }

        return $this->can(UserPermission::TASKS_VIEW_ASSIGNED->value);
    }
}
