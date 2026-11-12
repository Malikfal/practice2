<?php

namespace App\Http\Resources\Workspace;

use App\Models\ProjectAssignmentHistory;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProjectAssignmentHistory */
final class ProjectAssignmentHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'project_id' => (string) $this->project_id,
            'user_id' => (string) $this->user_id,
            'is_pm' => (bool) $this->is_pm,
            'is_pm_payroll_enabled' => (bool) $this->is_pm_payroll_enabled,
            'started_on' => $this->started_on?->toDateString(),
            'ended_on' => $this->ended_on?->toDateString(),
            'project' => $this->project ? [
                'id' => (string) $this->project->id,
                'name' => $this->project->name,
            ] : null,
            'employee' => $this->user ? [
                'id' => (string) $this->user->id,
                'name' => $this->user->name,
                'last_name' => $this->user->last_name,
                'email' => $this->user->email,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
