<?php

namespace App\Http\Resources\Workspace;

use App\Enums\UserPermission;
use App\Models\KnowledgeBaseArticle;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin KnowledgeBaseArticle
 */
final class KnowledgeBaseArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $author = $this->author;

        return [
            'id' => (string) $this->id,
            'folder_id' => $this->folder_id ? (string) $this->folder_id : null,
            'folder' => $this->folder ? [
                'id' => (string) $this->folder->id,
                'name' => (string) $this->folder->name,
            ] : null,
            'title' => (string) $this->title,
            'content' => (string) $this->content,
            'is_pinned' => (bool) $this->is_pinned,
            'author' => $author ? $this->authorPayload($author) : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),

            $this->mergeWhen($this->canManageKnowledgeBase($viewer), [
                'is_draft' => (bool) $this->is_draft,
                'is_archive' => (bool) $this->is_archive,
            ]),
        ];
    }

    private function authorPayload(User $author): array
    {
        return [
            'id' => (string) $author->id,
            'name' => $author->name,
            'last_name' => $author->last_name,
            'avatar_url' => $author->avatar_url,
        ];
    }

    private function canManageKnowledgeBase(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::KNOWLEDGE_BASE_CREATE_UPDATE->value) ?? false;
    }
}
