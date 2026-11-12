<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinanceAnalyticsEmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'employee' => is_array(data_get($this->resource, 'employee'))
                ? data_get($this->resource, 'employee')
                : null,
            'expenses' => (int) data_get($this->resource, 'expenses', 0),
            'own_seconds' => (int) data_get($this->resource, 'own_seconds', 0),
            'supervised_seconds' => (int) data_get($this->resource, 'supervised_seconds', 0),
            'percent' => (float) data_get($this->resource, 'percent', 0),
        ];
    }
}
