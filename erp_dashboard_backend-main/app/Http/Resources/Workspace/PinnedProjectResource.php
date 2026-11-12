<?php

namespace App\Http\Resources\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Project
 */
final class PinnedProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $status = $this->status instanceof ProjectStatus
            ? $this->status
            : ProjectStatus::tryFrom((string) $this->status) ?? ProjectStatus::ACTIVE;

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $status->value,
            'status_label' => $status->label(),
            'pinned_at' => $this->pivot?->created_at?->toISOString(),
        ];
    }
}
