<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeePayrollCalculationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class EmployeePayrollCalculationResponse extends JsonResponse
{
    public function __construct(Collection $rows, string $from, string $to, array $meta)
    {
        parent::__construct([
            'from' => $from,
            'to' => $to,
            'data' => EmployeePayrollCalculationResource::collection($rows->values())->resolve(request()),
            'meta' => $meta,
        ]);
    }
}
