<?php

namespace App\Http\Responses\Workspace;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class PlannedExpensePaymentsResponse extends JsonResponse
{
    public function __construct(Collection $payments)
    {
        parent::__construct(['data' => $payments->values()->all()]);
    }
}
