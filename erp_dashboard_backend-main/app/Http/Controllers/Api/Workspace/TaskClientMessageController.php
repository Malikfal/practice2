<?php

namespace App\Http\Controllers\Api\Workspace;

use App\Http\Controllers\Controller;
use App\Http\Requests\Workspace\TaskClientMessageStoreRequest;
use App\Http\Requests\Workspace\TaskClientMessagesViewRequest;
use App\Http\Requests\Workspace\TaskPublicLinkManageRequest;
use App\Http\Responses\Workspace\TaskClientMessageIndexResponse;
use App\Http\Responses\Workspace\TaskClientMessageResponse;
use App\Models\Task;
use App\Models\TaskClientMessageAttachment;
use App\Models\TaskPublicLink;
use App\Services\Workspace\TaskClientMessageService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TaskClientMessageController extends Controller
{
    public function __construct(
        private readonly TaskClientMessageService $service,
    ) {}
    public function index(TaskClientMessagesViewRequest $request, Task $task): JsonResponse
    {
        $messages = $task->clientMessages()
            ->with(['author', 'attachments'])
            ->orderBy('created_at', 'asc')
            ->get();
            
        return new TaskClientMessageIndexResponse($messages, $task->client_approval_status);
    }
    public function store(TaskClientMessageStoreRequest $request, Task $task): JsonResponse
    {
        $message = $this->service->create(
            $task,
            $request->validated(),
            $request->user(),
            $request->file('files', [])
        );
        
        return new TaskClientMessageResponse($message, 201);
    }
    
    public function attachment(TaskClientMessagesViewRequest $request, Task $task, TaskClientMessageAttachment $attachment): StreamedResponse
    {
        return $this->service->openAttachment($attachment);
    }
    
    public function storeLink(TaskPublicLinkManageRequest $request, Task $task): JsonResponse 
    {
        $link = $this->service->generatePublicLink($task, $request->user());

        return response()->json(['data' => $link]);
    }

    public function destroyLink(TaskPublicLinkManageRequest $request, Task $task): JsonResponse 
    {
        $this->service->disablePublicLink($task);
        return response()->json(['message' => 'Ссылка отключена']);
    }
}