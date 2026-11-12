<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectAssignmentHistoryResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectAssignmentHistoryIndexResponse extends JsonResponse
{
    public function __construct(Collection $assignments)
    {
        $assignments->loadMissing(['project', 'user']);

        parent::__construct([
            'data' => ProjectAssignmentHistoryResource::collection($assignments)->resolve(request()),
        ]);
    }
}
