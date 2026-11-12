<?php

namespace App\Http\Resources\Workspace;

use App\Models\EmployeeRate;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class EmployeeCurrentRateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $rate = $this->relationLoaded('currentRate')
            ? $this->getRelation('currentRate')
            : null;

        return [
            'employee' => EmployeeResource::make($this)->resolve($request),
            'current_rate' => $rate instanceof EmployeeRate
                ? EmployeeRateResource::make($rate)->resolve($request)
                : null,
        ];
    }
}
