<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeResource;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;

final class EmployeeIndexResponse extends JsonResponse
{
    public function __construct(LengthAwarePaginator $employees, ?User $viewer = null, ?int $maxEmployees = null, int $totalCompanyEmployess = 0)
    {
        parent::__construct([
            'data' => EmployeeResource::collection($employees->getCollection())->resolve(request()),
            'meta' => [
                'current_page' => $employees->currentPage(),
                'last_page' => $employees->lastPage(),
                'per_page' => $employees->perPage(),
                'total' => $employees->total(),
                'max_employees' => $maxEmployees,
                'total_company_employees' => $totalCompanyEmployess,
            ],
        ]);
    }
}
