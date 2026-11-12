<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskCommentResource;
use App\Models\TaskComment;
use Illuminate\Http\JsonResponse;

final class TaskCommentResponse extends JsonResponse
{
    public function __construct(TaskComment $comment, int $status = 200)
    {
        $comment->loadMissing(['author', 'attachments']);

        parent::__construct(self::data($comment), $status);
    }

    public static function data(TaskComment $comment): array
    {
        return TaskCommentResource::make($comment)->resolve(request());
    }
}
