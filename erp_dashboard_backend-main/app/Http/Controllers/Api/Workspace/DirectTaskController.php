<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Requests\Workspace\DirectTaskUpdateRequest;
use App\Models\Task;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DirectTaskAccessRequest;
use App\Http\Responses\Workspace\TaskResponse;
use App\Services\Workspace\ProjectService;
use Illuminate\Http\JsonResponse;

class DirectTaskController extends Controller {

    public function __construct(
        private readonly ProjectService $project, 
    ){}
 
    public function show(DirectTaskAccessRequest $request, Task $task): JsonResponse {
        return new TaskResponse(
            $this->project->task($request->user(), $task->project, $task),
        );
    } 

    public function update(DirectTaskUpdateRequest $request, Task $task): JsonResponse {
        return new TaskResponse(
            $this->project->updateTask($task->project, $task, $request->validated()),
        );
    }
}