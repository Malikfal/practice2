<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinanceAnalyticsManagerResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'manager' => is_array(data_get($this->resource, 'manager'))
                ? data_get($this->resource, 'manager')
                : null,
            'income' => (int) data_get($this->resource, 'income', 0),
            'expenses' => (int) data_get($this->resource, 'expenses', 0),
            'profit' => (int) data_get($this->resource, 'profit', 0),
            'projects' => FinanceAnalyticsProjectSummaryResource::collection(
                collect(data_get($this->resource, 'projects', [])),
            )->resolve($request),
        ];
    }
}
