<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskCommentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TaskCommentIndexResponse extends JsonResponse
{
    public function __construct(Collection $comments)
    {
        parent::__construct([
            'data' => TaskCommentResource::collection($comments)->resolve(request()),
        ]);
    }
}
