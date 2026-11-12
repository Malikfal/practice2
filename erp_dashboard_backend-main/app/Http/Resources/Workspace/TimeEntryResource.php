<?php

namespace App\Http\Resources\Workspace;

use App\Enums\UserPermission;
use App\Models\User;
use App\Models\WorkSegment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin WorkSegment
 */
final class TimeEntryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $canViewDetails = $this->canViewDetails($viewer);

        return [
            'id' => (string) $this->id,
            'started_at' => $this->started_at !== null ? (int) $this->started_at : null,
            'ended_at' => $this->ended_at !== null ? (int) $this->ended_at : null,
            'duration_seconds' => $this->started_at && $this->ended_at
                ? (int) $this->ended_at - (int) $this->started_at
                : 0,
            'user' => $this->user ? [
                'id' => (string) $this->user->id,
                'first_name' => $this->user->first_name,
                'last_name' => $this->user->last_name,
            ] : null,
            'project' => $this->task?->project ? [
                'id' => (string) $this->task->project->id,
                'name' => $this->task->project->name,
            ] : null,

            $this->mergeWhen($canViewDetails, [
                'note' => $this->note,
                'created_by' => $this->created_by,
            ]),
        ];
    }

    private function canViewDetails(?User $viewer): bool
    {
        if (! $viewer) {
            return false;
        }

        return (string) $viewer->id === (string) $this->user_id
            || $viewer->can(UserPermission::TIME_VIEW_OTHERS->value)
            || $viewer->can(UserPermission::TIME_VIEW_ALL->value);
    }
}
