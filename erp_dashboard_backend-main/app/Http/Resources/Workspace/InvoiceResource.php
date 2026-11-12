<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource {
    public function toArray(Request $request): array {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'amount' => $this->amount,
            'period_days' => $this->period_days,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'paid_at' => $this->paid_at,
            'ends_at' => $this->ends_at,
            'created_at' => $this->created_at,
            'can_download_upd' => now()->isAfter($this->created_at->copy()->addDays($this->period_days)),
            'tariff' => new TariffResource($this->whenLoaded('tariff')),
        ];
    }
}