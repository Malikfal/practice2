<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\FinanceResource;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class FinanceIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator $finances)
    {
        parent::__construct([
            'data' => FinanceResource::collection($finances->getCollection())->resolve(request()),
            'meta' => [
                'current_page' => $finances->currentPage(),
                'last_page' => $finances->lastPage(),
                'per_page' => $finances->perPage(),
                'total' => $finances->total(),
            ],
        ]);
    }
}
