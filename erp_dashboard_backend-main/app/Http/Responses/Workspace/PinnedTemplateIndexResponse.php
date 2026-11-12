<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\PinnedTemplateResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class PinnedTemplateIndexResponse extends JsonResponse
{
    public function __construct(Collection $templates)
    {
        parent::__construct([
            'data' => PinnedTemplateResource::collection($templates)->resolve(request()),
        ]);
    }
}
