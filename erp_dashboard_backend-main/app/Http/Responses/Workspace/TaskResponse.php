<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;

final class TaskResponse extends JsonResponse
{
    public function __construct(Task $task, int $status = 200)
    {
        parent::__construct(self::data($task), $status);
    }

    public static function data(Task $task): array
    {
        return TaskResource::make($task)->resolve(request());
    }
}

