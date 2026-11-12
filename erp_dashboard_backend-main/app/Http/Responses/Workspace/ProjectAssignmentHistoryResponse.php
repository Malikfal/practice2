<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectAssignmentHistoryResource;
use App\Models\ProjectAssignmentHistory;
use Illuminate\Http\JsonResponse;

final class ProjectAssignmentHistoryResponse extends JsonResponse
{
    public function __construct(ProjectAssignmentHistory $assignment, int $status = 200)
    {
        $assignment->loadMissing(['project', 'user']);

        parent::__construct(ProjectAssignmentHistoryResource::make($assignment)->resolve(request()), $status);
    }
}
