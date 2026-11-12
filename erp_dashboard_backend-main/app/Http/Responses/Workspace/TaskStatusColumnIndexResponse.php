<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskStatusColumnResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TaskStatusColumnIndexResponse extends JsonResponse
{
    public function __construct(Collection $columns)
    {
        parent::__construct([
            'data' => TaskStatusColumnResource::collection($columns)->resolve(request()),
        ]);
    }
}
