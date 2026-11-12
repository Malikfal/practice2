<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectRateResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectRateIndexResponse extends JsonResponse
{
    public function __construct(Collection $rates)
    {
        $rates->loadMissing(['changer']);

        parent::__construct([
            'data' => ProjectRateResource::collection($rates)->resolve(request()),
        ]);
    }
}
