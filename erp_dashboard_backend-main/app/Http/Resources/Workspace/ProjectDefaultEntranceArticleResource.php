<?php

namespace App\Http\Resources\Workspace;

use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Project
 */
final class ProjectDefaultEntranceArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $article = $this->defaultEntranceFinanceArticle;

        return [
            'project_id' => (string) $this->id,
            'default_entrance_finance_article_id' => $this->default_entrance_finance_article_id
                ? (string) $this->default_entrance_finance_article_id
                : null,
            'default_entrance_finance_article' => $article ? [
                'id' => (string) $article->id,
                'name' => (string) $article->name,
            ] : null,
        ];
    }
}
