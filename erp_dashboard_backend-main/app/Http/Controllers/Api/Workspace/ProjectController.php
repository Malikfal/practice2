<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\AssignProjectMemberRequest;
use App\Http\Requests\Workspace\DeleteProjectRequest;
use App\Http\Requests\Workspace\DeleteProjectTaskRequest;
use App\Http\Requests\Workspace\MoveProjectTaskRequest;
use App\Http\Requests\Workspace\ProjectAccessRequest;
use App\Http\Requests\Workspace\ProjectIndexRequest;
use App\Http\Requests\Workspace\ProjectMembersManageRequest;
use App\Http\Requests\Workspace\StoreProjectFromTemplateRequest;
use App\Http\Requests\Workspace\StoreProjectRequest;
use App\Http\Requests\Workspace\StoreProjectTaskRequest;
use App\Http\Requests\Workspace\StoreTaskDescriptionImageRequest;
use App\Http\Requests\Workspace\UpdateProjectCreatorRequest;
use App\Http\Requests\Workspace\UpdateProjectRequest;
use App\Http\Requests\Workspace\UpdateProjectTaskRequest;
use App\Http\Requests\Workspace\ViewTaskDescriptionImageRequest;
use App\Http\Responses\Workspace\ProjectDetailsResponse;
use App\Http\Responses\Workspace\ProjectIndexResponse;
use App\Http\Responses\Workspace\ProjectResponse;
use App\Http\Responses\Workspace\TaskDescriptionImageUploadResponse;
use App\Http\Responses\Workspace\TaskListResponse;
use App\Http\Responses\Workspace\TaskResponse;
use App\Models\Project;
use App\Models\Task;
use App\Models\TaskDescriptionImage;
use App\Models\Template;
use App\Models\User;
use App\Services\Workspace\ProjectService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ProjectController extends Controller
{
    public function __construct(
        private readonly ProjectService $projects,
    ) {}

    public function index(ProjectIndexRequest $request): JsonResponse
    {
        return new ProjectIndexResponse(
            $this->projects->all($request->user(), $request->validated(), $this->companyId($request))
        );
    }

    public function store(StoreProjectRequest $request): JsonResponse
    {
        return new ProjectResponse(
            $this->projects->create($request->user(), $request->validated()),
            201,
        );
    }

    public function update(UpdateProjectRequest $request, Project $project): JsonResponse
    {
        return new ProjectResponse(
            $this->projects->update($project, $request->validated())
        );
    }

    public function changeCreator(UpdateProjectCreatorRequest $request, Project $project): JsonResponse
    {
        return new ProjectResponse(
            $this->projects->changeCreator(
                $project,
                (string) $request->validated('created_by_id'),
            )
        );
    }

    public function destroy(DeleteProjectRequest $request, Project $project): Response
    {
        $this->projects->delete($project);

        return response()->noContent();
    }

    public function show(ProjectAccessRequest $request, Project $project): JsonResponse
    {
        $details = $this->projects->details($project);

        return new ProjectDetailsResponse(
            $details['project'],
            $details['by_employee'],
        );
    }

    public function tasks(ProjectAccessRequest $request, Project $project): JsonResponse
    {
        return new TaskListResponse(
            $this->projects->tasks($request->user(), $project),
            $this->projects->taskBoardColumns($project),
        );
    }

    public function task(ProjectAccessRequest $request, Project $project, Task $task): JsonResponse
    {
        return new TaskResponse(
            $this->projects->task($request->user(), $project, $task)
        );
    }

    public function createTask(StoreProjectTaskRequest $request, Project $project): JsonResponse
    {
        return new TaskResponse(
            $this->projects->createTask($request->user(), $project, $request->validated()),
            201,
        );
    }

    public function updateTask(
        UpdateProjectTaskRequest $request,
        Project $project,
        Task $task,
    ): JsonResponse {
        return new TaskResponse(
            $this->projects->updateTask($project, $task, $request->validated()),
        );
    }


    public function deleteTask(
        DeleteProjectTaskRequest $request,
        Project $project,
        Task $task,
    ): Response {
        $this->projects->deleteTask($project, $task);

        return response()->noContent();
    }

    public function moveTask(
        MoveProjectTaskRequest $request,
        Project $project,
        Task $task,
    ): JsonResponse {
        $this->projects->moveTask($project, $task, $request->validated());

        return new TaskListResponse(
            $this->projects->tasks($request->user(), $project),
            $this->projects->taskBoardColumns($project),
        );
    }

    public function uploadTaskDescriptionImage(
        StoreTaskDescriptionImageRequest $request,
        Project $project,
        Task $task,
    ): JsonResponse {
        return new TaskDescriptionImageUploadResponse(
            $this->projects->storeTaskDescriptionImage(
                $request->user(),
                $project,
                $task,
                $request->imageFile(),
            )
        );
    }

    public function taskDescriptionImage(
        ViewTaskDescriptionImageRequest $request,
        TaskDescriptionImage $image,
    ): StreamedResponse {
        return $this->projects->openTaskDescriptionImage($request->user(), $image);
    }

    public function assignMember(AssignProjectMemberRequest $request, Project $project): JsonResponse
    {
        return new ProjectResponse(
            $this->projects->assignMember(
                $project,
                (string) $request->validated('user_id'),
                (bool) $request->validated('is_pm', false),
                (bool) $request->validated('is_pm_payroll_enabled', true),
            )
        );
    }

    public function removeMember(ProjectMembersManageRequest $request, Project $project, User $employee): JsonResponse
    {
        return new ProjectResponse(
            $this->projects->removeMember($project, $employee)
        );
    }

    public function userTasks(ProjectAccessRequest $request, Project $project, string $userId): JsonResponse
    {
        $user = User::withBlocked()
            ->where('company_id', $project->company_id)
            ->findOrFail($userId);
        $tasks = $this->projects->userTasks($project, $user);

        return new TaskListResponse($tasks, $this->projects->taskBoardColumns($project));
    }

    public function createFromTemplate(StoreProjectFromTemplateRequest $request, Template $template): JsonResponse
    {
        return new ProjectResponse(
            $this->projects->createFromTemplate(
                $request->user(),
                $template,
                $request->validated(),
            ),
            201,
        );
    }
}
