<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\Template;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class PinnedTemplateService
{
    public function list(User $user): Collection
    {
        if (
            ! $user->can(UserPermission::PROJECTS_VIEW_ALL->value)
            && ! $user->can(UserPermission::PROJECTS_VIEW_ASSIGNED->value)
        ) {
            return collect();
        }

        $query = $user->pinnedTemplates()
            ->with(['manager', 'members.user'])
            ->orderByPivot('created_at', 'desc')
            ->orderBy('templates.name');

        if (! $user->isSuperAdmin()) {
            $query->where('templates.company_id', $user->company_id);
        }

        return $query->get();
    }

    public function pin(User $user, Template $template): Template
    {
        $this->assertTemplateCanBePinned($user, $template);

        $user->pinnedTemplates()->syncWithoutDetaching([$template->id]);

        return $user->pinnedTemplates()
            ->with(['manager', 'members.user'])
            ->where('templates.id', $template->id)
            ->firstOrFail();
    }

    public function unpin(User $user, Template $template): void
    {
        $user->pinnedTemplates()->detach($template->id);
    }

    private function assertTemplateCanBePinned(User $user, Template $template): void
    {
        if (! $user->hasCompanyAccess((string) $template->company_id)) {
            throw ValidationException::withMessages([
                'template_id' => ['Шаблон не принадлежит компании пользователя.'],
            ]);
        }

        if (
            ! $user->can(UserPermission::PROJECTS_VIEW_ALL->value)
            && ! $user->can(UserPermission::PROJECTS_VIEW_ASSIGNED->value)
        ) {
            throw ValidationException::withMessages([
                'template_id' => ['Нет доступа к шаблонам проектов.'],
            ]);
        }
    }
}
