<?php

namespace App\Http\Responses\Workspace;

use App\Models\WorkSegment;
use Illuminate\Http\JsonResponse;

final class TimeEntryResponse extends JsonResponse
{
    public function __construct(WorkSegment $entry, int $status = 200)
    {
        parent::__construct([
            'id' => (string) $entry->id,
            'started_at' => $entry->started_at !== null ? (int) $entry->started_at : null,
            'ended_at' => $entry->ended_at !== null ? (int) $entry->ended_at : null,
            'duration_seconds' => $entry->started_at && $entry->ended_at
                ? (int) $entry->ended_at - (int) $entry->started_at
                : 0,
            'note' => $entry->note,
            'created_by' => $entry->created_by,
            'user' => [
                'id' => (string) $entry->user->id,
                'first_name' => $entry->user->first_name,
                'last_name' => $entry->user->last_name,
            ],
            'project' => [
                'id' => (string) $entry->task->project->id,
                'name' => $entry->task->project->name,
            ],
        ], $status);
    }
}
