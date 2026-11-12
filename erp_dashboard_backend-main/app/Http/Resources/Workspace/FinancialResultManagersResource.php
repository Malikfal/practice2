<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinancialResultManagersResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'filters' => data_get($this->resource, 'filters', []),
            'data' => FinancialResultManagerResource::collection(
                collect(data_get($this->resource, 'data', [])),
            )->resolve($request),
        ];
    }
}
