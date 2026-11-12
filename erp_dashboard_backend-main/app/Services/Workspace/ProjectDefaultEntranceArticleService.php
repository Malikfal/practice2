<?php

namespace App\Services\Workspace;

use App\Enums\FinanceType;
use App\Enums\UserPermission;
use App\Models\FinanceArticle;
use App\Models\Project;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProjectDefaultEntranceArticleService
{
    /** @return Collection<int, Project> */
    public function showMany(User $actor, array $projectIds): Collection
    {
        if (! $actor->can(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value)) {
            throw new NotFoundHttpException;
        }

        $projects = Project::query()
            ->whereIn('id', $projectIds)
            ->with('defaultEntranceFinanceArticle')
            ->get()
            ->keyBy('id');

        return collect($projectIds)->map(function (string $id) use ($actor, $projects): Project {
            $project = $projects->get($id);
            if (! $project || ! $actor->canAccessProject($project)) {
                throw new NotFoundHttpException;
            }

            return $project;
        });
    }

    public function show(User $actor, Project $project): Project
    {
        if (! $actor->can(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value)
            || ! $actor->canAccessProject($project)) {
            throw new NotFoundHttpException;
        }

        return $project->load('defaultEntranceFinanceArticle');
    }

    public function update(User $actor, Project $project, ?string $articleId): Project
    {
        if (! $actor->canPerformProjectAction($project, UserPermission::PROJECTS_CREATE_UPDATE->value)) {
            throw new NotFoundHttpException;
        }

        if ($articleId !== null && ! FinanceArticle::query()
            ->whereKey($articleId)
            ->where('company_id', $project->company_id)
            ->where('type', FinanceType::ENTRANCE->value)
            ->exists()) {
            throw ValidationException::withMessages([
                'default_entrance_finance_article_id' => ['Можно выбрать только статью поступления компании проекта.'],
            ]);
        }

        $project->update(['default_entrance_finance_article_id' => $articleId]);

        return $project->fresh('defaultEntranceFinanceArticle');
    }
}
