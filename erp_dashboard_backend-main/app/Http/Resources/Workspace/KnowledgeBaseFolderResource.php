<?php

namespace App\Http\Resources\Workspace;

use App\Enums\UserPermission;
use App\Models\KnowledgeBaseFolder;
use App\Models\User;
use App\Support\RoleCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin KnowledgeBaseFolder
 */
final class KnowledgeBaseFolderResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        return [
            'id' => (string) $this->id,
            'name' => (string) $this->name,
            'is_archive' => (bool) $this->is_archive,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            $this->mergeWhen($this->canManageKnowledgeBase($viewer), [
                'access' => [
                    'roles' => $this->accesses
                        ->whereNotNull('role')
                        ->pluck('role')
                        ->map(fn (string $role): array => [
                            'value' => $role,
                            'label' => RoleCatalog::labelForRole((string) $this->company_id, $role),
                        ])
                        ->values()
                        ->all(),
                    'users' => $this->accesses
                        ->whereNotNull('user_id')
                        ->map(static fn ($access): ?array => $access->user instanceof User ? [
                            'id' => (string) $access->user->id,
                            'name' => $access->user->name,
                            'last_name' => $access->user->last_name,
                            'email' => $access->user->email,
                            'role' => $access->user->role,
                            'role_label' => RoleCatalog::labelForRole(
                                (string) $access->user->company_id,
                                (string) $access->user->role,
                            ),
                            'avatar_url' => $access->user->avatar_url,
                            'position' => $access->user->position,
                        ] : null)
                        ->filter()
                        ->values()
                        ->all(),
                ],
            ]),
        ];
    }

    private function canManageKnowledgeBase(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::KNOWLEDGE_BASE_CREATE_UPDATE->value) ?? false;
    }
}
