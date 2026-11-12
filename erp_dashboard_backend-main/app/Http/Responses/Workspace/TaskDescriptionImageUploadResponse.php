<?php

namespace App\Http\Responses\Workspace;

use App\Models\TaskDescriptionImage;
use Illuminate\Http\JsonResponse;

final class TaskDescriptionImageUploadResponse extends JsonResponse
{
    public function __construct(TaskDescriptionImage $image, int $status = 201)
    {
        parent::__construct([
            'url' => '/task-description-images/'.$image->id,
        ], $status);
    }
}
