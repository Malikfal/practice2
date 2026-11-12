<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskResource;
use App\Http\Resources\Workspace\TaskStatusColumnResource;
use App\Services\Workspace\TaskViewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TaskListResponse extends JsonResponse
{
    public function __construct(Collection $tasks, Collection $columns)
    {
        app(TaskViewService::class)->attachViewerState($tasks, request()->user());

        parent::__construct([
            'columns' => TaskStatusColumnResource::collection($columns)->resolve(request()),
            'data' => TaskResource::collection($tasks)->resolve(request()),
        ]);
    }
}
