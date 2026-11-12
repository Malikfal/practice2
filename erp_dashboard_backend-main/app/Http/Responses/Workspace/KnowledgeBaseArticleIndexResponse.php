<?php

namespace App\Http\Responses\Workspace;

use App\Models\KnowledgeBaseArticle;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class KnowledgeBaseArticleIndexResponse extends JsonResponse
{
    public function __construct(Collection $articles)
    {
        $articles->loadMissing(['author', 'folder', 'accesses.user']);

        parent::__construct([
            'data' => $articles->map(
                static fn (KnowledgeBaseArticle $article): array => KnowledgeBaseArticleResponse::data($article)
            )->values(),
        ]);
    }
}
