<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Services\Workspace\UserTaskBoardService;
use Illuminate\Http\JsonResponse;
use App\Http\Requests\Workspace\UserTaskBoardRequest;
use App\Http\Responses\Workspace\UserTaskBoardResponse;
use App\Http\Requests\Workspace\MoveUserTaskBoardRequest;
use App\Models\Task;

class UserTaskBoardController extends Controller
{
    public function __construct(
        private readonly UserTaskBoardService $service,
    ) {}

    public function index(UserTaskBoardRequest $request): JsonResponse
    {
        return new UserTaskBoardResponse(
            $this->service->board($request->user(), $request->validated()),
        );
    }

    public function move(
        MoveUserTaskBoardRequest $request,
        Task $task,
    ): JsonResponse {
        $this->service->move($request->user(), $task, $request->validated());

        return new UserTaskBoardResponse(
            $this->service->board($request->user(), $request->validated()),
        );
    }
}
