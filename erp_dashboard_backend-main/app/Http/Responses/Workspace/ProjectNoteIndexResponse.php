<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectNoteResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectNoteIndexResponse extends JsonResponse
{
    public function __construct(Collection $projectNotes)
    {
        parent::__construct([
            'data' => ProjectNoteResource::collection($projectNotes)->resolve(request()),
        ]);
    }
}
