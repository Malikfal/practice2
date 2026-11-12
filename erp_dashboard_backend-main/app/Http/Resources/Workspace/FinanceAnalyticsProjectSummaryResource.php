<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinanceAnalyticsProjectSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'project' => $this->nullableObject('project'),
            'client' => $this->nullableObject('client'),
            'income' => (int) data_get($this->resource, 'income', 0),
            'direct_expenses' => (int) data_get($this->resource, 'direct_expenses', 0),
            'allocated_expenses' => (int) data_get($this->resource, 'allocated_expenses', 0),
            'expenses' => (int) data_get($this->resource, 'expenses', 0),
            'profit' => (int) data_get($this->resource, 'profit', 0),
        ];
    }

    private function nullableObject(string $key): ?array
    {
        $value = data_get($this->resource, $key);

        return is_array($value) ? $value : null;
    }
}
