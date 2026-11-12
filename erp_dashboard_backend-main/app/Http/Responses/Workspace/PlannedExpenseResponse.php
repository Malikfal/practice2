<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\PlannedExpenseResource;
use App\Models\PlannedExpense;
use Illuminate\Http\JsonResponse;

final class PlannedExpenseResponse extends JsonResponse
{
    public function __construct(PlannedExpense $plannedExpense, int $status = 200)
    {
        parent::__construct(PlannedExpenseResource::make($plannedExpense)->resolve(request()), $status);
    }
}
