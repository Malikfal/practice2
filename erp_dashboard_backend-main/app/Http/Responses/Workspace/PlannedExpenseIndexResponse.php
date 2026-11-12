<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\PlannedExpenseResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class PlannedExpenseIndexResponse extends JsonResponse
{
    public function __construct(Collection $plannedExpenses)
    {
        parent::__construct([
            'data' => PlannedExpenseResource::collection($plannedExpenses)->resolve(request()),
        ]);
    }
}
