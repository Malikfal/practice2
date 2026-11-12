<?php

namespace App\Http\Responses\Workspace;

use App\Models\KnowledgeBaseFolder;
use App\Models\User;
use App\Support\RoleCatalog;
use Illuminate\Http\JsonResponse;

final class KnowledgeBaseFolderResponse extends JsonResponse
{
    public function __construct(KnowledgeBaseFolder $folder, int $status = 200)
    {
        $folder->loadMissing(['accesses.user']);

        parent::__construct(self::data($folder), $status);
    }

    public static function data(KnowledgeBaseFolder $folder): array
    {
        $folder->loadMissing(['accesses.user']);

        return [
            'id' => (string) $folder->id,
            'name' => (string) $folder->name,
            'is_archive' => (bool) $folder->is_archive,
            'company_id' => (string) $folder->company_id,
            'access' => [
                'roles' => $folder->accesses
                    ->whereNotNull('role')
                    ->pluck('role')
                    ->map(fn (string $role): array => [
                        'value' => $role,
                        'label' => RoleCatalog::labelForRole((string) $folder->company_id, $role),
                    ])
                    ->values()
                    ->all(),
                'users' => $folder->accesses
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
            'created_at' => $folder->created_at?->toISOString(),
            'updated_at' => $folder->updated_at?->toISOString(),
        ];
    }
}
