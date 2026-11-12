<?php

namespace App\Http\Responses\Workspace;

use App\Models\KnowledgeBaseArticle;
use App\Models\User;
use App\Support\RoleCatalog;
use Illuminate\Http\JsonResponse;

final class KnowledgeBaseArticleResponse extends JsonResponse
{
    public function __construct(KnowledgeBaseArticle $article, int $status = 200)
    {
        $article->loadMissing(['author', 'folder', 'accesses.user']);

        parent::__construct(self::data($article), $status);
    }

    public static function data(KnowledgeBaseArticle $article): array
    {
        $author = $article->author;

        return [
            'id' => (string) $article->id,
            'folder_id' => $article->folder_id ? (string) $article->folder_id : null,
            'folder' => $article->folder ? [
                'id' => (string) $article->folder->id,
                'name' => (string) $article->folder->name,
            ] : null,
            'title' => (string) $article->title,
            'content' => (string) $article->content,
            'is_draft' => (bool) $article->is_draft,
            'is_archive' => (bool) $article->is_archive,
            'is_pinned' => (bool) $article->is_pinned,
            'company_id' => (string) $article->company_id,
            'access' => [
                'roles' => $article->accesses
                    ->whereNotNull('role')
                    ->pluck('role')
                    ->map(fn (string $role): array => [
                        'value' => $role,
                        'label' => RoleCatalog::labelForRole((string) $article->company_id, $role),
                    ])
                    ->values()
                    ->all(),
                'users' => $article->accesses
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
            'author' => $author ? [
                'id' => (string) $author->id,
                'name' => $author->name,
                'last_name' => $author->last_name,
                'email' => $author->email,
                'role' => $author->role,
                'avatar_url' => $author->avatar_url,
                'position' => $author->position,
            ] : null,
            'created_at' => $article->created_at?->toISOString(),
            'updated_at' => $article->updated_at?->toISOString(),
        ];
    }
}
