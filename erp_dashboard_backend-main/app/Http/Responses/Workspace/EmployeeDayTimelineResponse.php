<?php

namespace App\Http\Responses\Workspace;

use App\Http\Resources\Workspace\EmployeeDayTimelineSegmentResource;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;

final class EmployeeDayTimelineResponse extends JsonResponse
{
    public function __construct(
        string $userId,
        Carbon $from,
        Carbon $to,
        Collection $segments,
        int $totalSeconds,
    ) {
        parent::__construct([
            'user_id' => $userId,
            'from' => $from->toISOString(),
            'to' => $to->toISOString(),
            'segments' => EmployeeDayTimelineSegmentResource::collection($segments->values())->resolve(request()),
            'total_seconds' => $totalSeconds,
        ]);
    }
}
