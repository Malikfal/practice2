<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinanceAnalyticsEmployeesResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'filters' => [
                'from' => (string) data_get($this->resource, 'filters.from'),
                'to' => (string) data_get($this->resource, 'filters.to'),
                'project_ids' => collect(data_get($this->resource, 'filters.project_ids', []))->values()->all(),
                'client_ids' => collect(data_get($this->resource, 'filters.client_ids', []))->values()->all(),
                'manager_ids' => collect(data_get($this->resource, 'filters.manager_ids', []))->values()->all(),
            ],
            'summary' => [
                'expenses' => (int) data_get($this->resource, 'summary.expenses', 0),
            ],
            'data' => FinanceAnalyticsEmployeeResource::collection(
                collect(data_get($this->resource, 'data', [])),
            )->resolve($request),
        ];
    }
}
