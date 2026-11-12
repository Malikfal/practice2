<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientContactResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class ClientContactIndexResponse extends JsonResponse
{
    public function __construct(Collection $contacts)
    {
        parent::__construct([
            'data' => ClientContactResource::collection($contacts)->resolve(request()),
        ]);
    }
}
