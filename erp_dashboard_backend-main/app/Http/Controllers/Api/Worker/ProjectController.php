<?php

namespace App\Http\Controllers\Api\Worker;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\ProjectIndexRequest;
use App\Http\Responses\Workspace\ProjectIndexResponse;
use App\Http\Responses\Workspace\TaskListResponse;
use App\Models\Project;
use App\Services\Worker\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function __construct(
        private readonly ProjectService $projects,
    ) {
    }

    public function index(ProjectIndexRequest $request): JsonResponse
    {
        return new ProjectIndexResponse(
            $this->projects->all($request->user(), $request->validated())
        );
    }

    public function tasks(Request $request, Project $project): JsonResponse
    {
        return new TaskListResponse(
            $this->projects->tasks($request->user(), $project),
            $this->projects->taskBoardColumns($project),
        );
    }

    public function userTasks(Request $request, Project $project, string $userId): JsonResponse
    {
        return new TaskListResponse(
            $this->projects->tasksForUser($request->user(), $project, $userId),
            $this->projects->taskBoardColumns($project),
        );
    }
}
