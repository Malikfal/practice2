<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\PinnedProjectResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class PinnedProjectIndexResponse extends JsonResponse
{
    public function __construct(Collection $projects)
    {
        parent::__construct([
            'data' => PinnedProjectResource::collection($projects)->resolve(request()),
        ]);
    }
}
