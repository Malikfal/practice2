<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeDocumentResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class EmployeeDocumentIndexResponse extends JsonResponse
{
    public function __construct(Collection $documents)
    {
        $documents->loadMissing(['uploader']);

        parent::__construct([
            'data' => EmployeeDocumentResource::collection($documents)->resolve(request()),
        ]);
    }
}
