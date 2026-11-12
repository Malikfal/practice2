<?php

namespace App\Http\Responses;

use App\Models\Document;
use App\Http\Resources\DocumentResource;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;

final class DocumentIndexResponse extends JsonResponse {
    
    /**
     * @param Collection<Document> $documents
     */
    public function __construct(Collection $documents) {
        parent::__construct([
            'data' => DocumentResource::collection($documents)->resolve(request()),
        ]);
    }
}