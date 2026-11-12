<?php
namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\TaskAttachmentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class TaskAttachmentIndexResponse extends JsonResponse
{
    public function __construct(Collection $attachments)
    {
        parent::__construct([
            'data' => TaskAttachmentResource::collection($attachments)->resolve(request()),
        ]);
    }
}