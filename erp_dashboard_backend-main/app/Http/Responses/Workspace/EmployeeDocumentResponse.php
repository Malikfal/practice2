<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeDocumentResource;
use App\Models\EmployeeDocument;
use Illuminate\Http\JsonResponse;

final class EmployeeDocumentResponse extends JsonResponse
{
    public function __construct(EmployeeDocument $document, int $status = 200)
    {
        $document->loadMissing(['uploader']);

        parent::__construct(self::data($document), $status);
    }

    public static function data(EmployeeDocument $document): array
    {
        return EmployeeDocumentResource::make($document)->resolve(request());
    }
}
