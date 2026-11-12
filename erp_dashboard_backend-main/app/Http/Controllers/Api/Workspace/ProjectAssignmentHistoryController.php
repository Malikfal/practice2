<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\EmployeeAssignmentHistoryIndexRequest;
use App\Http\Requests\Workspace\ManageProjectAssignmentHistoryRequest;
use App\Http\Requests\Workspace\ProjectAssignmentHistoryIndexRequest;
use App\Http\Requests\Workspace\StoreProjectAssignmentHistoryRequest;
use App\Http\Requests\Workspace\UpdateProjectAssignmentHistoryRequest;
use App\Http\Responses\Workspace\ProjectAssignmentHistoryIndexResponse;
use App\Http\Responses\Workspace\ProjectAssignmentHistoryResponse;
use App\Models\Project;
use App\Models\ProjectAssignmentHistory;
use App\Models\User;
use App\Services\Workspace\ProjectAssignmentHistoryService;
use Illuminate\Http\JsonResponse;

class ProjectAssignmentHistoryController extends Controller
{
    public function __construct(
        private readonly ProjectAssignmentHistoryService $assignments,
    ) {}

    public function projectIndex(ProjectAssignmentHistoryIndexRequest $request, Project $project): JsonResponse
    {
        return new ProjectAssignmentHistoryIndexResponse(
            $this->assignments->forProject($project, $request->validated()),
        );
    }

    public function employeeIndex(EmployeeAssignmentHistoryIndexRequest $request, User $employee): JsonResponse
    {
        return new ProjectAssignmentHistoryIndexResponse(
            $this->assignments->forEmployee($employee, $request->validated()),
        );
    }

    public function store(StoreProjectAssignmentHistoryRequest $request): JsonResponse
    {
        return new ProjectAssignmentHistoryResponse(
            $this->assignments->store($request->validated()),
            201,
        );
    }

    public function update(UpdateProjectAssignmentHistoryRequest $request, ProjectAssignmentHistory $assignment): JsonResponse
    {
        return new ProjectAssignmentHistoryResponse(
            $this->assignments->update($assignment, $request->validated()),
        );
    }

    public function destroy(ManageProjectAssignmentHistoryRequest $request, ProjectAssignmentHistory $assignment): JsonResponse
    {
        $this->assignments->destroy($assignment);

        return response()->json(null, 204);
    }
}
