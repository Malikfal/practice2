<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientLegalEntityResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ClientLegalEntityIndexResponse extends JsonResponse
{
    public function __construct(Collection $legalEntities)
    {
        parent::__construct([
            'data' => ClientLegalEntityResource::collection($legalEntities)->resolve(request()),
        ]);
    }
}
