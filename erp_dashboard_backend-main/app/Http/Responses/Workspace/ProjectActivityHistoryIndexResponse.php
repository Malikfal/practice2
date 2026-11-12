<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectActivityHistoryResource;
use App\Models\ProjectActivityHistory;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectActivityHistoryIndexResponse extends JsonResponse
{
    /** @param  Collection<int, ProjectActivityHistory>  $activities */
    public function __construct(Collection $activities)
    {
        $activities->loadMissing('project');

        parent::__construct([
            'data' => ProjectActivityHistoryResource::collection($activities)->resolve(request()),
        ]);
    }
}
