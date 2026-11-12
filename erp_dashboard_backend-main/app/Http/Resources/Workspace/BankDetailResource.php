<?php

namespace App\Http\Resources\Workspace;

use App\Models\BankDetail;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin BankDetail
 */
final class BankDetailResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => (string) $this->id,
            'employee_id' => (string) $this->employee_id,
            'details' => (string) $this->details,
            'created_at' => $this->created_at?->toISOString(),
            'updated_at' => $this->updated_at?->toISOString(),
        ];
    }
}
