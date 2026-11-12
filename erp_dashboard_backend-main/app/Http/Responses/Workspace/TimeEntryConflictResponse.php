<?php

namespace App\Http\Responses\Workspace;

use Illuminate\Http\JsonResponse;

final class TimeEntryConflictResponse extends JsonResponse
{
    public function __construct(int $startedAt, int $endedAt)
    {
        parent::__construct([
            'message' => 'У сотрудника уже есть пересечение по времени.',
            'conflict' => [
                'started_at' => $startedAt,
                'ended_at' => $endedAt,
            ],
        ], 422);
    }
}
