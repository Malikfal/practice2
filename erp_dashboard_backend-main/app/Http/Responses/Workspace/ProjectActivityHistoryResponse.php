<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectActivityHistoryResource;
use App\Models\ProjectActivityHistory;
use Illuminate\Http\JsonResponse;

final class ProjectActivityHistoryResponse extends JsonResponse
{
    public function __construct(ProjectActivityHistory $activity, int $status = 200)
    {
        $activity->loadMissing('project');

        parent::__construct(ProjectActivityHistoryResource::make($activity)->resolve(request()), $status);
    }
}
