<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Models\Task;
use App\Http\Requests\Workspace\DeleteTaskAttachmentRequest;
use App\Http\Requests\Workspace\StoreTaskAttachmentRequest;
use App\Http\Requests\Workspace\TaskAttachmentViewRequest;
use App\Http\Responses\Workspace\TaskAttachmentIndexResponse;
use App\Http\Responses\Workspace\TaskAttachmentResponse;
use App\Http\Controllers\Controller;
use App\Models\TaskAttachment;
use App\Services\Workspace\TaskAttachmentService;
use Illuminate\Http\Response;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskAttachmentController extends Controller{
    public function __construct(
        private readonly TaskAttachmentService $taskAttachment,
    ) {
    }

    public function index(TaskAttachmentViewRequest $request, Task $task): JsonResponse{ 
        return new TaskAttachmentIndexResponse(
            $this->taskAttachment->list($request->user(), $task)
        );
    }
    
    public function store(StoreTaskAttachmentRequest $request, Task $task): JsonResponse{
        $attachment = $this->taskAttachment->upload(
            $request->user(),
            $task,
            $request->file('file')
        );

        return new TaskAttachmentResponse($attachment, 201);
    }

    public function destroy(DeleteTaskAttachmentRequest $request, Task $task, TaskAttachment $attachment): Response {
        $this->taskAttachment->delete($request->user(), $task, $attachment);

        return response()->noContent();
    }

    public function attachment(TaskAttachmentViewRequest $request, TaskAttachment $attachment): StreamedResponse {
        return $this->taskAttachment->openAttachment($request->user(), $attachment);
    }
}