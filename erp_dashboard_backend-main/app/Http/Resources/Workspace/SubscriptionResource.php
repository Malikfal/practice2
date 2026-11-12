<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SubscriptionResource extends JsonResource {
    public function toArray(Request $request): array {
        $daysLeft = 0;
        if ($this->ends_at && $this->ends_at->isFuture()) {
            $daysLeft = (int) now()->startOfDay()->diffInDays($this->ends_at->copy()->startOfDay());
        }

        return [
            'id' => $this->id,
            'starts_at' => $this->starts_at,
            'ends_at' => $this->ends_at,
            'days_left' => $daysLeft,
            'tariff' => new TariffResource($this->whenLoaded('tariff')),
        ];
    }
}