<?php

namespace App\Http\Resources\Workspace;

use App\Models\ProjectRate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ProjectRate
 */
final class ProjectRateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $changer = $this->changer;

        return [
            'id' => (string) $this->id,
            'project_id' => (string) $this->project_id,
            'rate' => $this->rate,
            'vat' => $this->vat,
            'currency' => $this->currency->value,
            'effective_from' => $this->effective_from?->toDateString(),
            'changed_by' => $changer ? [
                'id' => (string) $changer->id,
                'name' => $changer->name,
                'last_name' => $changer->last_name,
                'email' => $changer->email,
            ] : null,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
