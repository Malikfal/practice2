<?php
namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskAttachmentResource;
use App\Models\TaskAttachment;
use Illuminate\Http\JsonResponse;

final class TaskAttachmentResponse extends JsonResponse
{
    public function __construct(TaskAttachment $attachment, int $status = 201)
    {
        $attachment->loadMissing(['uploader']);

        parent::__construct(self::data($attachment), $status);
    }

    public static function data(TaskAttachment $attachment): array
    {
        return TaskAttachmentResource::make($attachment)->resolve(request());
    }
}