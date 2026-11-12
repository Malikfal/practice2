<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskClientMessageResource;
use App\Models\TaskClientMessage;
use Illuminate\Http\JsonResponse;

final class TaskClientMessageResponse extends JsonResponse
{
    public function __construct(TaskClientMessage $message, int $status = 200)
    {
        parent::__construct([
            'data' => (new TaskClientMessageResource($message))->resolve(request()),
        ], $status);
    }
}