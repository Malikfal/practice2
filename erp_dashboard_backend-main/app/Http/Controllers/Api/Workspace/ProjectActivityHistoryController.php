<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ManageProjectActivityHistoryRequest;
use App\Http\Requests\Workspace\ProjectActivityHistoryIndexRequest;
use App\Http\Requests\Workspace\StoreProjectActivityHistoryRequest;
use App\Http\Requests\Workspace\UpdateProjectActivityHistoryRequest;
use App\Http\Responses\Workspace\ProjectActivityHistoryIndexResponse;
use App\Http\Responses\Workspace\ProjectActivityHistoryResponse;
use App\Models\Project;
use App\Models\ProjectActivityHistory;
use App\Services\Workspace\ProjectActivityHistoryService;
use Illuminate\Http\JsonResponse;

class ProjectActivityHistoryController extends Controller
{
    public function __construct(
        private readonly ProjectActivityHistoryService $activities,
    ) {}

    public function index(ProjectActivityHistoryIndexRequest $request, Project $project): JsonResponse
    {
        return new ProjectActivityHistoryIndexResponse(
            $this->activities->forProject($project),
        );
    }

    public function store(StoreProjectActivityHistoryRequest $request): JsonResponse
    {
        return new ProjectActivityHistoryResponse(
            $this->activities->store($request->validated()),
            201,
        );
    }

    public function update(UpdateProjectActivityHistoryRequest $request, ProjectActivityHistory $activity): JsonResponse
    {
        return new ProjectActivityHistoryResponse(
            $this->activities->update($activity, $request->validated()),
        );
    }

    public function destroy(ManageProjectActivityHistoryRequest $request, ProjectActivityHistory $activity): JsonResponse
    {
        $this->activities->destroy($activity);

        return response()->json(null, 204);
    }
}
