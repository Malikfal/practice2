<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinancialResultClientResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'client' => is_array(data_get($this->resource, 'client')) ? data_get($this->resource, 'client') : null,
            'income' => (int) data_get($this->resource, 'income', 0),
            'expenses' => (int) data_get($this->resource, 'expenses', 0),
            'profit' => (int) data_get($this->resource, 'profit', 0),
        ];
    }
}
