<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\FinanceArticleResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class FinanceArticleIndexResponse extends JsonResponse
{
    public function __construct(Collection $articles)
    {
        parent::__construct([
            'data' => FinanceArticleResource::collection($articles)->resolve(request()),
        ]);
    }
}
