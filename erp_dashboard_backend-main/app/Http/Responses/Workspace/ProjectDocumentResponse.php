<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ProjectDocumentResource;
use App\Models\ProjectDocument;
use Illuminate\Http\JsonResponse;

final class ProjectDocumentResponse extends JsonResponse
{
    public function __construct(ProjectDocument $document, int $status = 200)
    {
        $document->loadMissing(['uploader']);

        parent::__construct(self::data($document), $status);
    }

    public static function data(ProjectDocument $document): array
    {
        return ProjectDocumentResource::make($document)->resolve(request());
    }
}
