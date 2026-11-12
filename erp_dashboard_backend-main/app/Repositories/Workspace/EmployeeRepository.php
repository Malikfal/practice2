<?php

namespace App\Repositories\Workspace;

use App\Enums\ProjectStatus;
use App\Models\User;
use App\Support\CurrentDay;
use App\Support\CurrentWeek;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class EmployeeRepository
{
    public function paginate(string $companyId, string $status, string $search, int $perPage, ?string $sortBy = null, string $sortDirection = 'asc'): LengthAwarePaginator
    {
        [$weekFrom, $weekTo] = CurrentWeek::bounds($companyId);
        $weekStart = $weekFrom->timestamp;
        $weekEnd = $weekTo->timestamp;
        [$dayFrom, $dayTo] = CurrentDay::bounds($companyId);
        $dayStart = $dayFrom->timestamp;
        $dayEnd = $dayTo->timestamp;

        $query = ($status === 'all' || $status === 'blocked'
            ? User::withBlocked()
            : User::query())
            ->select('users.*')
            ->where('users.company_id', $companyId)
            ->whereDoesntHave('roleModel', static fn ($role) => $role->where('name', 'CLIENT'))
            ->selectRaw(
                'COALESCE((
                    SELECT SUM(GREATEST(0, LEAST(ws.ended_at, ?) - GREATEST(ws.started_at, ?)))
                    FROM work_segments ws
                    WHERE ws.user_id = users.id
                        AND ws.started_at < ?
                        AND ws.ended_at > ?
                ), 0) as total_seconds_for_week',
                [$weekEnd, $weekStart, $weekEnd, $weekStart],
            )
            ->selectRaw(
                'COALESCE((
                    SELECT SUM(GREATEST(0, LEAST(ws.ended_at, ?) - GREATEST(ws.started_at, ?)))
                    FROM work_segments ws
                    WHERE ws.user_id = users.id
                        AND ws.started_at < ?
                        AND ws.ended_at > ?
                ), 0) as total_seconds_for_day',
                [$dayEnd, $dayStart, $dayEnd, $dayStart],
            )
            ->selectRaw(
                'COALESCE((
                    SELECT SUM(GREATEST(0, ws.ended_at - ws.started_at))
                    FROM work_segments ws
                    WHERE ws.user_id = users.id
                ), 0) as total_seconds',
            )
            ->with('roleModel:id,name')
            ->withMax('workSegments as last_date_activity', 'ended_at');

        if ($status === 'blocked') {
            $query->where('status', 'BLOCKED');
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search): void {
                $like = '%'.mb_strtolower($search).'%';

                $builder
                    ->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(last_name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like])
                    ->orWhereHas('roleModel', static function ($roleQuery) use ($like): void {
                        $roleQuery
                            ->whereRaw('LOWER(name) LIKE ?', [$like])
                            ->orWhereRaw('LOWER(display_name) LIKE ?', [$like]);
                    });
            });
        }

        $this->applySorting($query, $sortBy, $sortDirection);

        return $query->paginate($perPage)->withQueryString();
    }

    private function applySorting(Builder $query, ?string $sortBy, string $direction): void
    {
        if ($sortBy === 'projects') {
            $query->addSelect([
                'active_projects_sort' => DB::table('project_members as pm')
                    ->join('projects as p', 'p.id', '=', 'pm.project_id')
                    ->selectRaw('COUNT(DISTINCT p.id)')
                    ->whereColumn('pm.user_id', 'users.id')
                    ->whereColumn('p.company_id', 'users.company_id')
                    ->where('p.status', ProjectStatus::ACTIVE->value),
            ])->orderBy('active_projects_sort', $direction);
        } elseif ($sortBy === 'total_seconds_for_week') {
            $query->orderBy('total_seconds_for_week', $direction);
        } elseif ($sortBy === 'last_date_activity') {
            $query->orderByRaw("last_date_activity {$direction} NULLS LAST");
        } elseif ($sortBy === 'first_name') {
            $query->orderByRaw("LOWER(SPLIT_PART(TRIM(users.name), ' ', 1)) {$direction}");
        } elseif ($sortBy === 'last_name') {
            $query->orderByRaw("LOWER(COALESCE(NULLIF(TRIM(users.last_name), ''), NULLIF(SPLIT_PART(TRIM(users.name), ' ', 2), ''), '')) {$direction}");
        } elseif ($sortBy === 'role') {
            $query->selectRaw('(SELECT LOWER(roles.name) FROM roles WHERE roles.id = users.role_id) as role_sort_name')
                ->orderByRaw("role_sort_name {$direction} NULLS LAST");
        } elseif ($sortBy === 'position') {
            $query->orderByRaw("LOWER(users.position) {$direction} NULLS LAST");
        } elseif ($sortBy === 'created_at') {
            $query->orderBy('users.created_at', $direction);
        } else {
            $query->orderBy('users.last_name')->orderBy('users.name')->orderBy('users.email');
        }

        $query->orderBy('users.id');
    }

    public function create(array $attributes): User
    {
        return User::create($attributes);
    }

    public function update(User $user, array $attributes): User
    {
        $user->update($attributes);

        return $user->fresh();
    }

    public function delete(User $user): void
    {
        $user->delete();
    }

    public function totalSeconds(User $user): int
    {
        return (int) $user->workSegments()
            ->selectRaw('COALESCE(SUM(GREATEST(0, ended_at - started_at)), 0) as total_seconds')
            ->value('total_seconds');
    }

    /**
     * @return array<int, string>
     */
    public function createdProjectNames(User $user): array
    {
        return $user->projects()
            ->orderBy('name')
            ->pluck('name')
            ->all();
    }
}
