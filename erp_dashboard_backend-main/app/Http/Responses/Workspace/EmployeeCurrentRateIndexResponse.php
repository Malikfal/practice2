<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeCurrentRateResource;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class EmployeeCurrentRateIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator $employees)
    {
        parent::__construct([
            'data' => EmployeeCurrentRateResource::collection($employees->getCollection())->resolve(request()),
            'meta' => [
                'current_page' => $employees->currentPage(),
                'last_page' => $employees->lastPage(),
                'per_page' => $employees->perPage(),
                'total' => $employees->total(),
            ],
        ]);
    }
}
