<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TemplateResource;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class TemplateIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator $templates)
    {
        parent::__construct([
            'data' => TemplateResource::collection($templates->getCollection())->resolve(request()),
            'meta' => [
                'current_page' => $templates->currentPage(),
                'last_page' => $templates->lastPage(),
                'per_page' => $templates->perPage(),
                'total' => $templates->total(),
            ],
        ]);
    }
}
