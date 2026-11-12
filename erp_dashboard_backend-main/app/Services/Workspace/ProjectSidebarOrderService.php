<?php

namespace App\Services\Workspace;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProjectSidebarOrderService
{
    public function list(User $user): Collection
    {
        $accessibleProjectIds = $this->accessibleProjectIds($user);

        if ($accessibleProjectIds === []) {
            return collect();
        }

        return DB::table('user_project_orders')
            ->where('user_id', $user->id)
            ->whereIn('project_id', $accessibleProjectIds)
            ->orderBy('position')
            ->pluck('project_id')
            ->map(static fn ($id): string => (string) $id)
            ->values();
    }

    public function reorder(User $user, array $projectIds): Collection
    {
        $accessibleProjectIds = $this->accessibleProjectIds($user);
        $accessibleProjectIdSet = array_fill_keys($accessibleProjectIds, true);

        $normalizedIds = collect($projectIds)
            ->map(static fn ($id): string => (string) $id)
            ->values();

        $invalidIds = $normalizedIds
            ->filter(static fn (string $id): bool => ! isset($accessibleProjectIdSet[$id]))
            ->values();

        if ($invalidIds->isNotEmpty()) {
            throw ValidationException::withMessages([
                'project_ids' => ['Нельзя изменить порядок недоступных проектов.'],
            ]);
        }

        DB::transaction(function () use ($accessibleProjectIds, $normalizedIds, $user): void {
            DB::table('user_project_orders')
                ->where('user_id', $user->id)
                ->whereIn('project_id', $accessibleProjectIds)
                ->delete();

            if ($normalizedIds->isEmpty()) {
                return;
            }

            $timestamp = now();

            DB::table('user_project_orders')->insert(
                $normalizedIds
                    ->values()
                    ->map(static fn (string $projectId, int $index): array => [
                        'user_id' => $user->id,
                        'project_id' => $projectId,
                        'position' => $index + 1,
                        'created_at' => $timestamp,
                        'updated_at' => $timestamp,
                    ])
                    ->all(),
            );
        });

        return $this->list($user);
    }

    /**
     * @return array<int, string>
     */
    private function accessibleProjectIds(User $user): array
    {
        return $this->accessibleProjectsQuery($user)
            ->pluck('projects.id')
            ->map(static fn ($id): string => (string) $id)
            ->all();
    }

    private function accessibleProjectsQuery(User $user): Builder
    {
        $query = Project::query()->select('projects.id');

        if (! $user->isSuperAdmin()) {
            $query->where('projects.company_id', $user->company_id);
        }

        if ($user->canViewAllProjects()) {
            return $query;
        }

        if (! $user->canViewAssignedProjects()) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereHas('members', static function (Builder $members) use ($user): void {
            $members->where('user_id', $user->id);
        });
    }
}
