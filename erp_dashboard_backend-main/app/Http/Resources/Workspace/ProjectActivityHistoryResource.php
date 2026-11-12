<?php

namespace App\Http\Resources\Workspace;

use App\Models\ProjectActivityHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProjectActivityHistory */
final class ProjectActivityHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'project_id' => (string) $this->project_id,
            'started_on' => $this->started_on?->toDateString(),
            'ended_on' => $this->ended_on?->toDateString(),
            'is_current' => $this->ended_on === null,
            'project' => $this->project ? [
                'id' => (string) $this->project->id,
                'name' => $this->project->name,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
