<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Models\Task;
use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\TaskActivityIndexRequest;
use App\Http\Responses\Workspace\TaskActivityIndexResponse;
use App\Services\Workspace\TaskActivityService;
use Illuminate\Http\JsonResponse;

class TaskActivityController extends Controller
{
    public function __construct(
        private readonly TaskActivityService $activity,
    ) {
    }

    public function index(TaskActivityIndexRequest $request, Task $task) : JsonResponse
    {

        return new TaskActivityIndexResponse(
            $this->activity->list($request->user(), $task)
        );
    }    
}
