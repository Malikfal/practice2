<?php

namespace App\Http\Resources\Workspace;

use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Client
 */
final class ClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'weekly_limit_seconds' => $this->weekly_limit_seconds,
            'contacts' => $this->whenLoaded(
                'contacts',
                fn () => ClientContactResource::collection($this->contacts)->resolve($request),
            ),
            'legal_entities' => $this->whenLoaded(
                'legalEntities',
                fn () => ClientLegalEntityResource::collection($this->legalEntities)->resolve($request),
            ),
            'projects' => $this->whenLoaded(
                'projects',
                fn () => ClientProjectResource::collection($this->projects)->resolve($request),
            ),
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
