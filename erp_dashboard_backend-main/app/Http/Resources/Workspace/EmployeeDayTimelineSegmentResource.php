<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class EmployeeDayTimelineSegmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $segment = (array) $this->resource;

        return [
            'id' => data_get($this->resource, 'id'),
            'task_id' => data_get($this->resource, 'task_id'),
            'task_name' => data_get($this->resource, 'task_name'),
            'project_id' => data_get($this->resource, 'project_id'),
            'project_name' => data_get($this->resource, 'project_name'),
            'started_at' => (int) data_get($this->resource, 'started_at', 0),
            'ended_at' => (int) data_get($this->resource, 'ended_at', 0),
            'clamped_started_at' => (int) data_get($this->resource, 'clamped_started_at', 0),
            'clamped_ended_at' => (int) data_get($this->resource, 'clamped_ended_at', 0),
            'duration_seconds' => (int) data_get($this->resource, 'duration_seconds', 0),

            $this->mergeWhen(array_key_exists('note', $segment), [
                'note' => data_get($this->resource, 'note'),
                'created_by' => data_get($this->resource, 'created_by'),
                'created_by_name' => data_get($this->resource, 'created_by_name'),
            ]),
        ];
    }
}
