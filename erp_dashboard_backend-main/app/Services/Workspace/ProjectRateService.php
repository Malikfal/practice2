<?php

namespace App\Services\Workspace;

use App\Enums\Currency;
use App\Enums\UserPermission;
use App\Models\Company;
use App\Models\Project;
use App\Models\ProjectRate;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectRateService
{
    public function list(User $user, Project $project): Collection
    {
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_TABS_ABOUT_VIEW->value);

        return ProjectRate::query()
            ->with(['changer'])
            ->where('project_id', $project->id)
            ->orderBy('effective_from', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();
    }

    public function current(User $user, Project $project): ?ProjectRate
    {
        $this->assertProjectAccess($user, $project, UserPermission::PROJECTS_TABS_ABOUT_VIEW->value);

        return ProjectRate::query()
            ->with(['changer'])
            ->where('project_id', $project->id)
            ->whereDate('effective_from', '<=', Company::todayFor((string) $project->company_id))
            ->orderBy('effective_from', 'desc')
            ->orderBy('created_at', 'desc')
            ->first();
    }

    public function store(User $user, Project $project, array $data): ProjectRate
    {
        $this->assertProjectAccess(
            $user,
            $project,
            UserPermission::PROJECTS_CREATE_UPDATE->value,
            requireAssignedAccess: true,
        );
        $this->assertAtLeastOneRateFilled($data);

        $attributes = [
            'rate' => $data['rate'] ?? null,
            'vat' => $data['vat'] ?? null,
            'currency' => $data['currency'] ?? Currency::RUB->value,
            'changed_by' => $user->id,
        ];

        // На одну дату у проекта одна ставка: повторное сохранение на ту же дату заменяет её.
        $existing = ProjectRate::query()
            ->where('project_id', $project->id)
            ->whereDate('effective_from', $data['effective_from'])
            ->first();
        if ($existing) {
            $existing->update($attributes);

            return $existing->load(['changer']);
        }

        return ProjectRate::create([
            'id' => (string) Str::uuid(),
            'project_id' => $project->id,
            'effective_from' => $data['effective_from'],
            ...$attributes,
        ])->load(['changer']);
    }

    private function assertAtLeastOneRateFilled(array $data): void
    {
        $hasRate = collect([
            $data['rate'] ?? null,
            $data['vat'] ?? null,
        ])->contains(static fn ($value): bool => $value !== null && $value !== '');

        if (! $hasRate) {
            throw ValidationException::withMessages([
                'rate' => ['Укажите ставку проекта или НДС.'],
            ]);
        }
    }

    private function assertProjectAccess(
        User $user,
        Project $project,
        string $permission,
        bool $requireAssignedAccess = false,
    ): void
    {
        $this->assertPermission($user, $permission);

        $hasProjectAccess = $requireAssignedAccess
            ? $user->canAccessAssignedProject($project)
            : $user->canAccessProject($project);

        if (! $hasProjectAccess) {
            throw new NotFoundHttpException;
        }
    }

    private function assertPermission(User $user, string $permission): void
    {
        if (! $user->can($permission)) {
            throw new NotFoundHttpException;
        }
    }

    private function projectCompanyId(Project $project): string
    {
        $companyId = (string) $project->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }
}
