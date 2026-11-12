<?php

namespace App\Services\Workspace;

use App\Models\Project;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TagService
{
    public function list(array $data, string $companyId): Collection
    {
        $search = trim((string) ($data['search'] ?? ''));
        $normalizedSearch = $this->normalizeName($search);

        return Tag::query()
            ->where('company_id', $companyId)
            ->when($search !== '', function ($query) use ($search, $normalizedSearch): void {
                $query->where(function ($query) use ($search, $normalizedSearch): void {
                    $query
                        ->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($search).'%'])
                        ->orWhere('normalized_name', 'like', '%'.$normalizedSearch.'%');
                });
            })
            ->orderBy('name')
            ->limit(50)
            ->get();
    }

    public function syncProjectTags(User $user, Project $project, array $rawTagNames): Project
    {
        $this->assertProjectBelongsToUserCompany($user, $project);

        $tagNames = $this->normalizeTagNames($rawTagNames);
        $companyId = (string) $project->company_id;

        return DB::transaction(function () use ($project, $tagNames, $companyId): Project {
            $tagIds = [];

            foreach ($tagNames as $name) {
                $tag = Tag::query()->firstOrCreate(
                    [
                        'company_id' => $companyId,
                        'normalized_name' => $this->normalizeName($name),
                    ],
                    [
                        'id' => (string) Str::uuid(),
                        'name' => $name,
                    ]
                );

                $tagIds[] = $tag->id;
            }

            $project->tags()->sync($tagIds);

            return $project->fresh()->load(['client', 'members.user', 'tags']);
        });
    }

    private function assertProjectBelongsToUserCompany(User $user, Project $project): void
    {
        if (! $user->canAccessAssignedProject($project)) {
            throw ValidationException::withMessages([
                'project_id' => ['Нет доступа к изменению тегов этого проекта.'],
            ]);
        }
    }

    private function normalizeTagNames(array $rawTagNames): Collection
    {
        return collect($rawTagNames)
            ->filter(static fn (mixed $value): bool => is_string($value))
            ->map(static fn (string $value): string => trim($value))
            ->filter(static fn (string $value): bool => $value !== '')
            ->unique(fn (string $value): string => $this->normalizeName($value))
            ->values();
    }

    private function normalizeName(string $name): string
    {
        return mb_strtolower(trim($name));
    }
}
