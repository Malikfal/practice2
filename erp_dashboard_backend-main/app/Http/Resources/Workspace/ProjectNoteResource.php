<?php

namespace App\Http\Resources\Workspace;

use App\Enums\ProjectNoteVisibility;
use App\Models\ProjectNote;
use App\Support\RoleCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProjectNote
 */
final class ProjectNoteResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $author = $this->author;
        $changer = $this->changer;

        return [
            'id' => (string) $this->id,
            'project_id' => (string) $this->project_id,
            'title' => $this->title,
            'content' => $this->content,
            'visibility' => $this->visibility?->value ?? ProjectNoteVisibility::PROJECT->value,
            'is_pinned' => (bool) ($this->is_pinned ?? false),
            'visible_users' => $this->whenLoaded('visibleUsers', fn () => $this->visibleUsers->map(static fn ($user): array => [
                'id' => (string) $user->id,
                'name' => $user->name,
                'last_name' => $user->last_name,
                'email' => $user->email,
            ])->values()->all()),
            'access' => $this->when(
                $this->relationLoaded('visibleUsers') || $this->relationLoaded('visibleRoles'),
                fn (): array => [
                    'roles' => $this->visibleRoles
                        ->pluck('role')
                        ->map(fn (string $role): array => [
                            'value' => $role,
                            'label' => RoleCatalog::labelForRole((string) $this->company_id, $role) ?? $role,
                        ])
                        ->values()
                        ->all(),
                    'users' => $this->visibleUsers->map(static fn ($user): array => [
                        'id' => (string) $user->id,
                        'name' => $user->name,
                        'last_name' => $user->last_name,
                        'email' => $user->email,
                        'role' => (string) $user->role,
                        'role_label' => RoleCatalog::labelForRole((string) $user->company_id, (string) $user->role),
                        'avatar_url' => $user->avatar_url,
                        'position' => $user->position,
                    ])->values()->all(),
                ],
            ),
            'author' => $author ? [
                'id' => (string) $author->id,
                'name' => $author->name,
                'last_name' => $author->last_name,
                'email' => $author->email,
            ] : null,
            'changed_by' => $changer ? [
                'id' => (string) $changer->id,
                'name' => $changer->name,
                'last_name' => $changer->last_name,
                'email' => $changer->email,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
