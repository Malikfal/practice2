<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteTaskStatusColumnRequest;
use App\Http\Requests\Workspace\ReorderTaskStatusColumnsRequest;
use App\Http\Requests\Workspace\StoreTaskStatusColumnRequest;
use App\Http\Requests\Workspace\TaskStatusColumnViewRequest;
use App\Http\Requests\Workspace\UpdateTaskStatusColumnRequest;
use App\Http\Responses\Workspace\TaskStatusColumnIndexResponse;
use App\Http\Responses\Workspace\TaskStatusColumnResponse;
use App\Models\Project;
use App\Models\TaskStatusColumn;
use App\Services\Workspace\ProjectTaskStatusColumnService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class ProjectTaskStatusColumnController extends Controller
{
    public function __construct(
        private readonly ProjectTaskStatusColumnService $columns,
    ) {
    }

    public function index(TaskStatusColumnViewRequest $request, Project $project): JsonResponse
    {
        return new TaskStatusColumnIndexResponse(
            $this->columns->list($project)
        );
    }

    public function store(StoreTaskStatusColumnRequest $request, Project $project): JsonResponse
    {
        return new TaskStatusColumnResponse(
            $this->columns->store($request->user(), $project, $request->validated()),
            201,
        );
    }

    public function update(
        UpdateTaskStatusColumnRequest $request,
        Project $project,
        TaskStatusColumn $column,
    ): JsonResponse {
        return new TaskStatusColumnResponse(
            $this->columns->update($request->user(), $project, $column, $request->validated())
        );
    }

    public function destroy(DeleteTaskStatusColumnRequest $request, Project $project, TaskStatusColumn $column): Response
    {
        $this->columns->delete($request->user(), $project, $column);

        return response()->noContent();
    }

    public function reorder(ReorderTaskStatusColumnsRequest $request, Project $project): JsonResponse
    {
        return new TaskStatusColumnIndexResponse(
            $this->columns->reorder($request->user(), $project, $request->validated('columns'))
        );
    }
}
