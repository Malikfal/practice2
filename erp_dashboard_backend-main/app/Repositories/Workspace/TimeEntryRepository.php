<?php

namespace App\Repositories\Workspace;

use App\Models\Task;
use App\Models\WorkSegment;
use Illuminate\Database\Eloquent\Model;

class TimeEntryRepository
{
    public function findOverlap(string $userId, int $startedAt, int $endedAt): ?Model
    {
        return WorkSegment::query()
            ->where('work_segments.user_id', $userId)
            ->where('work_segments.started_at', '<', $endedAt)
            ->where('work_segments.ended_at', '>', $startedAt)
            ->orderBy('work_segments.started_at')
            ->select([
                'work_segments.started_at',
                'work_segments.ended_at',
            ])
            ->first();
    }

    public function firstOrCreateManualTask(
        string $projectId, 
        string $taskId, 
        string $title = '',
        array $attributes = []
        ): Task
    {
        $normalizedTitle = trim($title) !== '' ? trim($title) : 'Ручное время';

        return Task::firstOrCreate(
            [
                'project_id' => $projectId,
                'title' => $normalizedTitle,
            ],
            [
                'id' => $taskId,
                ...$attributes
            ]
        );
    }

    public function create(array $attributes): WorkSegment
    {
        return WorkSegment::create($attributes);
    }
}
