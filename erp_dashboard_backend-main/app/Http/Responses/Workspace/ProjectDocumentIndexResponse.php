<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectDocumentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ProjectDocumentIndexResponse extends JsonResponse
{
    public function __construct(Collection $documents)
    {
        $documents->loadMissing(['uploader']);

        parent::__construct([
            'data' => ProjectDocumentResource::collection($documents)->resolve(request()),
        ]);
    }
}
