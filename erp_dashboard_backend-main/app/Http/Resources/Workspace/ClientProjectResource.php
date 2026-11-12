<?php

namespace App\Http\Resources\Workspace;

use App\Enums\ProjectStatus;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Project
 */
final class ClientProjectResource extends JsonResource
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
            'client_id' => $this->client_id ? (string) $this->client_id : null,
            'starts_at' => $this->starts_at?->toISOString(),
            'ends_at' => $this->ends_at?->toISOString(),
            'budget' => $this->budget,
            'current_rate' => $this->current_rate ? [
                'id' => (string) $this->current_rate->id,
                'rate' => $this->current_rate->rate,
                'vat' => $this->current_rate->vat,
                'currency' => $this->current_rate->currency->value,
                'effective_from' => $this->current_rate->effective_from?->toDateString(),
            ] : null,
        ];
    }
}
