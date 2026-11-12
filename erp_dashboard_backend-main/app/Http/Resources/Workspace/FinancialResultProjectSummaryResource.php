<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinancialResultProjectSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'project' => is_array(data_get($this->resource, 'project')) ? data_get($this->resource, 'project') : null,
            'client' => is_array(data_get($this->resource, 'client')) ? data_get($this->resource, 'client') : null,
            'income' => (int) data_get($this->resource, 'income', 0),
            'direct_expenses' => (int) data_get($this->resource, 'direct_expenses', 0),
            'expenses' => (int) data_get($this->resource, 'expenses', 0),
            'profit' => (int) data_get($this->resource, 'profit', 0),
        ];
    }
}
