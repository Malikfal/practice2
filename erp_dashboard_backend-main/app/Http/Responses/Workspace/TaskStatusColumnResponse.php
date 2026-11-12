<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskStatusColumnResource;
use App\Models\TaskStatusColumn;
use Illuminate\Http\JsonResponse;

final class TaskStatusColumnResponse extends JsonResponse
{
    public function __construct(TaskStatusColumn $column, int $status = 200)
    {
        parent::__construct(self::data($column), $status);
    }

    public static function data(TaskStatusColumn $column): array
    {
        return TaskStatusColumnResource::make($column)->resolve(request());
    }
}
