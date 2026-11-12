<?php

namespace App\Http\Responses\External;

use Illuminate\Http\JsonResponse;

final class WorkSegmentsReportResponse extends JsonResponse
{
    public function __construct(array $data, int $status = 200)
    {
        parent::__construct($data, $status);
    }
}
