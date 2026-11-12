<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\DeleteTaskCommentRequest;
use App\Http\Requests\Workspace\TaskCommentViewRequest;
use App\Http\Requests\Workspace\StoreTaskCommentRequest;
use App\Http\Responses\Workspace\TaskCommentIndexResponse;
use App\Http\Responses\Workspace\TaskCommentResponse;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskCommentAttachment;
use App\Services\Workspace\TaskCommentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskCommentController extends Controller
{
    public function __construct(
        private readonly TaskCommentService $comments,
    ) {
    }

    public function index(TaskCommentViewRequest $request, Task $task): JsonResponse
    {
        return new TaskCommentIndexResponse(
            $this->comments->list($request->user(), $task)
        );
    }

    public function store(StoreTaskCommentRequest $request, Task $task): JsonResponse
    {
        $comment = $this->comments->create(
            $request->user(),
            $task,
            $request->validated(),
            $request->file('files', []),
        );

        return new TaskCommentResponse($comment, 201);
    }

    public function destroy(DeleteTaskCommentRequest $request, Task $task, TaskComment $comment): Response
    {
        $this->comments->delete($request->user(), $task, $comment);

        return response()->noContent();
    }

    public function attachment(TaskCommentViewRequest $request, TaskCommentAttachment $attachment): StreamedResponse
    {
        return $this->comments->openAttachment($request->user(), $attachment);
    }
}
