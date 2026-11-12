<?php

namespace App\Services\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Models\KnowledgeBaseArticle;
use App\Models\KnowledgeBaseDocument;
use App\Models\KnowledgeBaseFolder;
use App\Models\KnowledgeBaseFolderAccess;
use App\Models\User;
use App\Support\PermissionAccess;
use App\Support\RoleCatalog;
use App\Support\RoutePermissions;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class KnowledgeBaseFolderService
{
    public function folders(User $user): Collection
    {
        return KnowledgeBaseFolder::query()
            ->with(['accesses.user'])
            ->where('company_id', $this->companyId($user))
            ->where(static function ($query) use ($user): void {
                $query
                    ->doesntHave('accesses')
                    ->orWhereHas('accesses', static function ($query) use ($user): void {
                        $query
                            ->where('role', (string) $user->role)
                            ->orWhere('user_id', $user->id);
                    });
            })
            ->orderBy('name')
            ->orderByDesc('created_at')
            ->get();
    }

    public function createFolder(User $user, array $data): KnowledgeBaseFolder
    {
        $companyId = $this->companyId($user);
        $access = $this->normalizeAccess($companyId, $data['access'] ?? []);

        return DB::transaction(function () use ($companyId, $data, $access): KnowledgeBaseFolder {
            $folder = KnowledgeBaseFolder::create([
                'id' => (string) Str::uuid(),
                'company_id' => $companyId,
                'name' => $data['name'],
                'is_archive' => false,
            ]);

            $this->replaceFolderAccesses($folder, $access);

            return $folder->load(['accesses.user']);
        });
    }

    public function updateFolder(User $user, KnowledgeBaseFolder $folder, array $data): KnowledgeBaseFolder
    {
        if (! $this->userCanAccessFolder($user, $folder)) {
            abort(403, 'У вас нет доступа к выбранной папке базы знаний.');
        }

        $folder->fill([
            'name' => $data['name'] ?? $folder->name,
            'is_archive' => array_key_exists('is_archive', $data) && $data['is_archive'] !== null
                ? (bool) $data['is_archive']
                : $folder->is_archive,
        ])->save();

        return $folder->load(['accesses.user']);
    }

    public function syncFolderAccesses(User $user, KnowledgeBaseFolder $folder, array $data): KnowledgeBaseFolder
    {
        if (! $this->userCanAccessFolder($user, $folder)) {
            abort(403, 'У вас нет доступа к выбранной папке базы знаний.');
        }

        $access = $this->normalizeAccess($this->companyId($user), $data);

        DB::transaction(function () use ($folder, $access): void {
            $this->replaceFolderAccesses($folder, $access);
        });

        return $folder->load(['accesses.user']);
    }

    public function deleteFolder(User $user, KnowledgeBaseFolder $folder): void
    {
        if (! $this->userCanAccessFolder($user, $folder)) {
            abort(403, 'У вас нет доступа к выбранной папке базы знаний.');
        }

        $documents = KnowledgeBaseDocument::query()
            ->whereIn(
                'article_id',
                KnowledgeBaseArticle::query()
                    ->where('folder_id', $folder->id)
                    ->select('id')
            )
            ->get(['disk', 'path']);

        DB::transaction(static function () use ($folder): void {
            $folder->delete();
        });

        foreach ($documents as $document) {
            Storage::disk($document->disk)->delete($document->path);
        }
    }

    public function resolveFolder(User $user, ?string $folderId): ?KnowledgeBaseFolder
    {
        if (! $folderId) {
            return null;
        }

        $folder = KnowledgeBaseFolder::query()
            ->where('company_id', $this->companyId($user))
            ->where('id', $folderId)
            ->first();

        if (! $folder) {
            throw new NotFoundHttpException;
        }

        return $folder;
    }

    public function userCanAccessFolder(User $user, KnowledgeBaseFolder $folder): bool
    {
        if ((string) $folder->company_id !== $this->companyId($user)) {
            return false;
        }

        $folder->loadMissing(['accesses.user']);

        if ($folder->accesses->isEmpty()) {
            return true;
        }

        return $folder->accesses->contains('role', (string) $user->role) ||
            $folder->accesses->contains(static fn(KnowledgeBaseFolderAccess $access): bool => (string) $access->user_id === (string) $user->id);
    }

    public function canManage(User $user): bool
    {
        return PermissionAccess::canAny(
            $user,
            RoutePermissions::resolve(PermissionAction::CREATE_UPDATE, PermissionSection::KNOWLEDGE_BASE),
        );
    }

    public function companyId(User $user): string
    {
        $companyId = (string) $user->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }

    public function normalizeAccess(string $companyId, array $data): array
    {
        $roles = collect($data['roles'] ?? [])
            ->map(static fn(string $role): string => trim($role))
            ->filter()
            ->unique()
            ->values();

        $allowedRoles = collect(RoleCatalog::assignableValuesForCompany($companyId));

        $invalidRoles = $roles
            ->reject(static fn(string $role): bool => $allowedRoles->containsStrict($role))
            ->values();

        if ($invalidRoles->isNotEmpty()) {
            throw ValidationException::withMessages([
                'roles' => ['Некорректные роли доступа: ' . $invalidRoles->implode(', ')],
            ]);
        }

        $userIds = collect($data['user_ids'] ?? [])
            ->map(static fn(string $userId): string => trim($userId))
            ->filter()
            ->unique()
            ->values();

        $users = User::query()
            ->where('company_id', $companyId)
            ->whereIn('id', $userIds)
            ->get(['id']);

        if ($users->count() !== $userIds->count()) {
            throw ValidationException::withMessages([
                'user_ids' => ['Один или несколько пользователей не найдены в текущей компании.'],
            ]);
        }

        return [
            'roles' => $roles->all(),
            'users' => $users->pluck('id')->map(static fn(string $id): string => $id)->all(),
        ];
    }

    private function replaceFolderAccesses(KnowledgeBaseFolder $folder, array $access): void
    {
        $folder->accesses()->delete();

        foreach ($access['roles'] as $role) {
            KnowledgeBaseFolderAccess::insertOrIgnore([
                'id' => (string) Str::uuid(),
                'company_id' => $folder->company_id,
                'folder_id' => $folder->id,
                'role' => $role,
            ]);
        }

        foreach ($access['users'] as $userId) {
            KnowledgeBaseFolderAccess::insertOrIgnore([
                'id' => (string) Str::uuid(),
                'company_id' => $folder->company_id,
                'folder_id' => $folder->id,
                'user_id' => $userId,
            ]);
        }
    }
}
