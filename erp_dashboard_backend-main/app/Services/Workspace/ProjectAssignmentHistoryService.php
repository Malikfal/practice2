<?php

namespace App\Services\Workspace;

use App\Models\Project;
use App\Models\ProjectAssignmentHistory;
use App\Models\User;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectAssignmentHistoryService
{
    /** @return Collection<int, ProjectAssignmentHistory> */
    public function forProject(Project $project, array $filters): Collection
    {
        return ProjectAssignmentHistory::query()
            ->with(['project', 'user'])
            ->where('project_id', $project->id)
            ->when(
                ($filters['employee_ids'] ?? []) !== [],
                fn (Builder $query) => $query->whereIn('user_id', $filters['employee_ids']),
            )
            ->orderByDesc('started_on')
            ->orderByDesc('created_at')
            ->get();
    }

    /** @return Collection<int, ProjectAssignmentHistory> */
    public function forEmployee(User $employee, array $filters): Collection
    {
        return ProjectAssignmentHistory::query()
            ->with(['project', 'user'])
            ->where('user_id', $employee->id)
            ->when(
                ($filters['project_ids'] ?? []) !== [],
                fn (Builder $query) => $query->whereIn('project_id', $filters['project_ids']),
            )
            ->orderByDesc('started_on')
            ->orderByDesc('created_at')
            ->get();
    }

    public function store(array $data): ProjectAssignmentHistory
    {
        $project = Project::query()->findOrFail($data['project_id']);
        $employee = User::withBlocked()
            ->where('company_id', $project->company_id)
            ->findOrFail($data['user_id']);

        return DB::transaction(function () use ($project, $employee, $data): ProjectAssignmentHistory {
            $this->lockProject($project);
            $timezone = $project->company()->firstOrFail()->payrollTimezone();
            $history = $this->lockedHistory((string) $project->id, (string) $employee->id);
            $startedOn = $this->day($data['started_on'], $timezone);
            $endedOn = $this->day($data['ended_on'], $timezone);

            $this->assertPeriodBounds($project, $startedOn, $endedOn, true, $timezone);
            $this->assertDoesNotOverlap($history, $startedOn, $endedOn, null, $timezone);

            return ProjectAssignmentHistory::query()->create([
                'id' => (string) Str::uuid(),
                'project_id' => $project->id,
                'user_id' => $employee->id,
                'is_pm' => (bool) ($data['is_pm'] ?? false),
                'is_pm_payroll_enabled' => (bool) (($data['is_pm'] ?? false) && ($data['is_pm_payroll_enabled'] ?? false)),
                'started_on' => $startedOn->toDateString(),
                'ended_on' => $endedOn->toDateString(),
            ])->load(['project', 'user']);
        });
    }

    public function update(ProjectAssignmentHistory $assignment, array $data): ProjectAssignmentHistory
    {
        return DB::transaction(function () use ($assignment, $data): ProjectAssignmentHistory {
            $assignment->loadMissing('project');
            $project = $assignment->project;
            if (! $project) {
                throw new NotFoundHttpException;
            }

            $this->lockProject($project);
            $timezone = $project->company()->firstOrFail()->payrollTimezone();
            $history = $this->lockedHistory((string) $assignment->project_id, (string) $assignment->user_id);
            $locked = $history->first(
                static fn (ProjectAssignmentHistory $item): bool => (string) $item->id === (string) $assignment->id,
            );
            if (! $locked) {
                throw new NotFoundHttpException;
            }
            if ($locked->ended_on === null) {
                throw ValidationException::withMessages([
                    'assignment' => ['Открытое назначение нельзя изменять. Нужно сначала снять сотрудника с проекта чтобы назначение закрылось.'],
                ]);
            }
            if (array_key_exists('ended_on', $data) && $data['ended_on'] === null) {
                throw ValidationException::withMessages([
                    'ended_on' => ['Закрытое назначение нельзя сделать текущим.'],
                ]);
            }

            $startedOn = $this->day($data['started_on'] ?? $locked->started_on, $timezone);
            $endedOn = $this->day($data['ended_on'] ?? $locked->ended_on, $timezone);
            $this->assertPeriodBounds($project, $startedOn, $endedOn, false, $timezone);
            $this->assertDoesNotOverlap($history, $startedOn, $endedOn, (string) $locked->id, $timezone);

            $isPm = (bool) ($data['is_pm'] ?? $locked->is_pm);
            $locked->update([
                'is_pm' => $isPm,
                'is_pm_payroll_enabled' => (bool) ($isPm
                    && ($data['is_pm_payroll_enabled'] ?? $locked->is_pm_payroll_enabled)),
                'started_on' => $startedOn->toDateString(),
                'ended_on' => $endedOn->toDateString(),
            ]);

            return $locked->load(['project', 'user']);
        });
    }

    public function destroy(ProjectAssignmentHistory $assignment): void
    {
        DB::transaction(function () use ($assignment): void {
            $assignment->loadMissing('project');
            if (! $assignment->project) {
                throw new NotFoundHttpException;
            }

            $this->lockProject($assignment->project);
            $locked = ProjectAssignmentHistory::query()->whereKey($assignment->id)->lockForUpdate()->first();
            if (! $locked) {
                throw new NotFoundHttpException;
            }
            if ($locked->ended_on === null) {
                throw ValidationException::withMessages([
                    'assignment' => ['Можно удалить только закрытое назначение.'],
                ]);
            }

            $locked->delete();
        });
    }

    /** @return Collection<int, ProjectAssignmentHistory> */
    private function lockedHistory(string $projectId, string $userId): Collection
    {
        return ProjectAssignmentHistory::query()
            ->where('project_id', $projectId)
            ->where('user_id', $userId)
            ->orderBy('started_on')
            ->lockForUpdate()
            ->get();
    }

    private function lockProject(Project $project): void
    {
        Project::query()->whereKey($project->id)->lockForUpdate()->firstOrFail();
    }

    private function assertPeriodBounds(
        Project $project,
        CarbonImmutable $startedOn,
        CarbonImmutable $endedOn,
        bool $manualCreation,
        string $timezone,
    ): void {
        $projectCreatedOn = CarbonImmutable::instance($project->created_at)
            ->setTimezone($timezone)
            ->startOfDay();
        $today = CarbonImmutable::today($timezone);

        if ($startedOn->lt($projectCreatedOn)) {
            throw ValidationException::withMessages([
                'started_on' => [sprintf('Дата начала не может быть раньше даты создания проекта: %s.', $projectCreatedOn->toDateString())],
            ]);
        }
        if ($startedOn->gt($today) || ($manualCreation && ! $startedOn->lt($today))) {
            throw ValidationException::withMessages([
                'started_on' => ['Дата начала ручного назначения должна относиться к предыдущим дням.'],
            ]);
        }
        if (! $endedOn->gt($startedOn)) {
            throw ValidationException::withMessages([
                'ended_on' => ['Дата окончания должна быть позже даты начала.'],
            ]);
        }
        if ($endedOn->gt($today)) {
            throw ValidationException::withMessages([
                'ended_on' => ['Дата окончания не может быть позже текущего дня.'],
            ]);
        }
    }

    /** @param Collection<int, ProjectAssignmentHistory> $history */
    private function assertDoesNotOverlap(
        Collection $history,
        CarbonImmutable $startedOn,
        CarbonImmutable $endedOn,
        ?string $exceptId,
        string $timezone,
    ): void {
        $overlap = $history->contains(function (ProjectAssignmentHistory $item) use ($startedOn, $endedOn, $exceptId, $timezone): bool {
            if ($exceptId !== null && (string) $item->id === $exceptId) {
                return false;
            }

            $existingStart = $this->day($item->started_on, $timezone);
            $existingEnd = $item->ended_on ? $this->day($item->ended_on, $timezone) : null;

            return $existingStart->lt($endedOn)
                && ($existingEnd === null || $existingEnd->gt($startedOn));
        });

        if ($overlap) {
            throw ValidationException::withMessages([
                'assignment' => ['Период назначения пересекается с существующим назначением сотрудника на этот проект.'],
            ]);
        }
    }

    private function day(string|CarbonInterface $value, string $timezone): CarbonImmutable
    {
        $date = $value instanceof CarbonInterface ? $value->toDateString() : $value;

        return CarbonImmutable::parse($date, $timezone)->startOfDay();
    }
}
