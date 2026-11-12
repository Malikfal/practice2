<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\ClientResource;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class ClientIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator $clients)
    {
        parent::__construct([
            'data' => ClientResource::collection($clients->getCollection())->resolve(request()),
            'meta' => [
                'current_page' => $clients->currentPage(),
                'last_page' => $clients->lastPage(),
                'per_page' => $clients->perPage(),
                'total' => $clients->total(),
            ],
        ]);
    }
}
