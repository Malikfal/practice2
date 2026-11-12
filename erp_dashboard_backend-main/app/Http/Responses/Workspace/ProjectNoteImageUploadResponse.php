<?php

namespace App\Http\Responses\Workspace;

use App\Models\ProjectNoteImage;
use Illuminate\Http\JsonResponse;

final class ProjectNoteImageUploadResponse extends JsonResponse
{
    public function __construct(ProjectNoteImage $image, int $status = 201)
    {
        parent::__construct([
            'url' => '/project-note-images/'.$image->id,
        ], $status);
    }
}
