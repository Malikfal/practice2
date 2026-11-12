<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\UserTaskBoardTaskResource;
use App\Http\Resources\Workspace\TaskStatusColumnResource;
use App\Services\Workspace\TaskViewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class UserTaskBoardResponse extends JsonResponse
{
    /**
     * @param array{
     *     columns: Collection,
     *     data: Collection
     * } $board
     */
    public function __construct(array $board)
    {
        app(TaskViewService::class)->attachViewerState($board['data'], request()->user());

        parent::__construct([
            'columns' => TaskStatusColumnResource::collection($board['columns'])->resolve(request()),
            'data' => UserTaskBoardTaskResource::collection($board['data'])->resolve(request()),
        ]);
    }
}
