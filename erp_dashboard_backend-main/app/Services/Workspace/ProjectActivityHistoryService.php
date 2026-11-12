<?php

namespace App\Services\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Project;
use App\Models\ProjectActivityHistory;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectActivityHistoryService
{
    public function __construct(
        private readonly FinanceAnalyticsCacheService $financeAnalyticsCache,
    ) {}

    /** @return Collection<int, ProjectActivityHistory> */
    public function forProject(Project $project): Collection
    {
        return ProjectActivityHistory::query()
            ->with('project')
            ->where('project_id', $project->id)
            ->orderByDesc('started_on')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Добавляет только завершённый исторический период. Текущий период создаётся при активации проекта.
     *
     * @param  array{project_id: string, started_on: string, ended_on: string}  $data
     */
    public function store(array $data): ProjectActivityHistory
    {
        $project = Project::query()->with('company')->findOrFail($data['project_id']);

        $activity = DB::transaction(function () use ($project, $data): ProjectActivityHistory {
            $lockedProject = $this->lockProject($project);
            $timezone = $this->timezone($lockedProject);
            $history = $this->lockedHistory((string) $lockedProject->id);
            $startedOn = $this->day($data['started_on'], $timezone);
            $endedOn = $this->day($data['ended_on'], $timezone);

            $this->assertPeriodBounds($lockedProject, $startedOn, $endedOn, $timezone);
            $this->assertDoesNotOverlap($history, $startedOn, $endedOn, null, $timezone);

            return ProjectActivityHistory::query()->create([
                'id' => (string) Str::uuid(),
                'project_id' => $lockedProject->id,
                'started_on' => $startedOn->toDateString(),
                'ended_on' => $endedOn->toDateString(),
            ])->load('project');
        });

        $this->financeAnalyticsCache->invalidateCompany((string) $project->company_id);

        return $activity;
    }

    /**
     * Открытому периоду разрешено менять начало, но дата окончания управляется только статусом проекта.
     *
     * @param  array{started_on?: string, ended_on?: string|null}  $data
     */
    public function update(ProjectActivityHistory $activity, array $data): ProjectActivityHistory
    {
        $companyId = (string) $activity->project()->value('company_id');
        $updated = DB::transaction(function () use ($activity, $data): ProjectActivityHistory {
            $activity->loadMissing('project.company');
            if (! $activity->project) {
                throw new NotFoundHttpException;
            }

            $project = $this->lockProject($activity->project);
            $timezone = $this->timezone($project);
            $history = $this->lockedHistory((string) $project->id);
            $locked = $history->first(
                static fn (ProjectActivityHistory $period): bool => (string) $period->id === (string) $activity->id,
            );
            if (! $locked) {
                throw new NotFoundHttpException;
            }

            $isOpen = $locked->ended_on === null;
            if ($isOpen && array_key_exists('ended_on', $data) && $data['ended_on'] !== null) {
                throw ValidationException::withMessages([
                    'ended_on' => ['Открытый период закрывается только при архивации проекта.'],
                ]);
            }
            if (! $isOpen && array_key_exists('ended_on', $data) && $data['ended_on'] === null) {
                throw ValidationException::withMessages([
                    'ended_on' => ['Закрытый период нельзя сделать текущим вручную.'],
                ]);
            }

            $startedOn = $this->day($data['started_on'] ?? $locked->started_on, $timezone);
            $endedOn = $isOpen
                ? null
                : $this->day($data['ended_on'] ?? $locked->ended_on, $timezone);

            $this->assertPeriodBounds($project, $startedOn, $endedOn, $timezone);
            $this->assertDoesNotOverlap($history, $startedOn, $endedOn, (string) $locked->id, $timezone);

            $locked->update([
                'started_on' => $startedOn->toDateString(),
                'ended_on' => $endedOn?->toDateString(),
            ]);

            return $locked->load('project');
        });

        $this->financeAnalyticsCache->invalidateCompany($companyId);

        return $updated;
    }

    public function destroy(ProjectActivityHistory $activity): void
    {
        $companyId = (string) $activity->project()->value('company_id');

        DB::transaction(function () use ($activity): void {
            $activity->loadMissing('project');
            if (! $activity->project) {
                throw new NotFoundHttpException;
            }

            $this->lockProject($activity->project);
            $locked = ProjectActivityHistory::query()->whereKey($activity->id)->lockForUpdate()->first();
            if (! $locked) {
                throw new NotFoundHttpException;
            }
            if ($locked->ended_on === null) {
                throw ValidationException::withMessages([
                    'activity' => ['Текущий период активности нельзя удалить.'],
                ]);
            }

            $locked->delete();
        });

        $this->financeAnalyticsCache->invalidateCompany($companyId);
    }

    /** Создаёт первый период сразу после создания проекта. Вызывать внутри транзакции создания. */
    public function createInitialPeriod(Project $project): void
    {
        $project->loadMissing('company');
        $timezone = $this->timezone($project);
        $startedOn = CarbonImmutable::instance($project->created_at)->setTimezone($timezone)->startOfDay();
        $endedOn = $project->status === ProjectStatus::ARCHIVED
            ? CarbonImmutable::today($timezone)
            : null;

        ProjectActivityHistory::query()->create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'started_on' => $startedOn->toDateString(),
            'ended_on' => $endedOn?->toDateString(),
        ]);
    }

    /** Открывает или закрывает текущий период после фактической смены статуса проекта. */
    public function syncStatus(Project $project, ProjectStatus $previousStatus): void
    {
        $project->loadMissing('company');
        $currentStatus = $project->status instanceof ProjectStatus
            ? $project->status
            : ProjectStatus::from((string) $project->status);

        if ($currentStatus === $previousStatus) {
            return;
        }

        $timezone = $this->timezone($project);
        $today = CarbonImmutable::today($timezone);
        $history = $this->lockedHistory((string) $project->id);
        /** @var ProjectActivityHistory|null $openPeriod */
        $openPeriod = $history->first(static fn (ProjectActivityHistory $period): bool => $period->ended_on === null);

        if ($currentStatus === ProjectStatus::ARCHIVED) {
            $openPeriod?->update(['ended_on' => $today->toDateString()]);

            return;
        }

        if ($openPeriod === null) {
            ProjectActivityHistory::query()->create([
                'id' => (string) Str::uuid(),
                'project_id' => $project->id,
                'started_on' => $today->toDateString(),
                'ended_on' => null,
            ]);
        }
    }

    /** @return Collection<int, ProjectActivityHistory> */
    private function lockedHistory(string $projectId): Collection
    {
        return ProjectActivityHistory::query()
            ->where('project_id', $projectId)
            ->orderBy('started_on')
            ->lockForUpdate()
            ->get();
    }

    private function lockProject(Project $project): Project
    {
        return Project::query()->with('company')->whereKey($project->id)->lockForUpdate()->firstOrFail();
    }

    private function assertPeriodBounds(
        Project $project,
        CarbonImmutable $startedOn,
        ?CarbonImmutable $endedOn,
        string $timezone,
    ): void {
        $today = CarbonImmutable::today($timezone);

        if ($startedOn->gt($today)) {
            throw ValidationException::withMessages([
                'started_on' => ['Дата начала не может быть позже текущего дня.'],
            ]);
        }
        if ($endedOn !== null && ! $endedOn->gt($startedOn)) {
            throw ValidationException::withMessages([
                'ended_on' => ['Дата окончания должна быть позже даты начала.'],
            ]);
        }
        if ($endedOn?->gt($today)) {
            throw ValidationException::withMessages([
                'ended_on' => ['Дата окончания не может быть позже текущего дня.'],
            ]);
        }
    }

    /** @param  Collection<int, ProjectActivityHistory>  $history */
    private function assertDoesNotOverlap(
        Collection $history,
        CarbonImmutable $startedOn,
        ?CarbonImmutable $endedOn,
        ?string $exceptId,
        string $timezone,
    ): void {
        $overlap = $history->contains(function (ProjectActivityHistory $period) use ($startedOn, $endedOn, $exceptId, $timezone): bool {
            if ($exceptId !== null && (string) $period->id === $exceptId) {
                return false;
            }

            $existingStart = $this->day($period->started_on, $timezone);
            $existingEnd = $period->ended_on ? $this->day($period->ended_on, $timezone) : null;

            return ($endedOn === null || $existingStart->lt($endedOn))
                && ($existingEnd === null || $existingEnd->gt($startedOn));
        });

        if ($overlap) {
            throw ValidationException::withMessages([
                'activity' => ['Период активности пересекается с существующим периодом проекта.'],
            ]);
        }
    }

    private function timezone(Project $project): string
    {
        return $project->company?->payrollTimezone()
            ?: (string) config('payroll.timezone', 'Europe/Moscow')
            ?: 'Europe/Moscow';
    }

    private function day(string|CarbonInterface $value, string $timezone): CarbonImmutable
    {
        $date = $value instanceof CarbonInterface ? $value->toDateString() : $value;

        return CarbonImmutable::parse($date, $timezone)->startOfDay();
    }
}
