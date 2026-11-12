<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\FinanceArticleResource;
use App\Models\FinanceArticle;
use Illuminate\Http\JsonResponse;

final class FinanceArticleResponse extends JsonResponse
{
    public function __construct(FinanceArticle $article, int $status = 200)
    {
        parent::__construct(self::data($article), $status);
    }

    public static function data(FinanceArticle $article): array
    {
        return FinanceArticleResource::make($article)->resolve(request());
    }
}
