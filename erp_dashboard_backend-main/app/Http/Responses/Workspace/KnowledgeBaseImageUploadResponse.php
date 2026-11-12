<?php

namespace App\Http\Responses\Workspace;

use App\Models\KnowledgeBaseDocument;
use Illuminate\Http\JsonResponse;

final class KnowledgeBaseImageUploadResponse extends JsonResponse
{
    public function __construct(KnowledgeBaseDocument $document, int $status = 201)
    {
        parent::__construct([
            'url' => '/knowledge-base/images/'.$document->id,
        ], $status);
    }
}
