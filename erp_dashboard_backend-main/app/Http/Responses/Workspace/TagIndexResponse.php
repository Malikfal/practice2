<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TagResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TagIndexResponse extends JsonResponse
{
    public function __construct(Collection $tags)
    {
        parent::__construct([
            'data' => TagResource::collection($tags)->resolve(request()),
        ]);
    }
}
