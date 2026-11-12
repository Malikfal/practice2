<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeRateResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class EmployeeRateIndexResponse extends JsonResponse
{
    public function __construct(Collection $rates)
    {
        $rates->loadMissing(['changer']);

        parent::__construct([
            'data' => EmployeeRateResource::collection($rates)->resolve(request()),
        ]);
    }
}
