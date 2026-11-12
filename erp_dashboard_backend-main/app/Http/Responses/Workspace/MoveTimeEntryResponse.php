<?php

namespace App\Http\Responses\Workspace;

use Illuminate\Http\JsonResponse;

final class MoveTimeEntryResponse extends JsonResponse
{
    public function __construct(array $result, int $status = 200)
    {
        parent::__construct([
            'message' => (string) ($result['message'] ?? 'Время успешно перенесено.'),
            'data' => [
                'moved_segment_id' => $result['moved_segment_id'] ?? null,
                'destination_task_id' => $result['destination_task_id'] ?? null,
            ],
        ], $status);
    }
}
