<?php

namespace App\Http\Responses\Workspace;

use Illuminate\Http\JsonResponse;

final class CalculateChangeResponse extends JsonResponse
{
    public function __construct(array $calculation, int $status = 200)
    {
        parent::__construct([
            'data' => $calculation,
        ], $status);
    }
}
