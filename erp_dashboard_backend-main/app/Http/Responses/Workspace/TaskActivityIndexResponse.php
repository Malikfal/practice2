<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskActivityResource;
use Illuminate\Support\Collection;
use Illuminate\Http\JsonResponse;

final class TaskActivityIndexResponse extends JsonResponse {
    public function __construct(Collection $activities)
    {
        parent::__construct([
            'data' => TaskActivityResource::collection($activities)->resolve(request()),
        ]);
    }
}