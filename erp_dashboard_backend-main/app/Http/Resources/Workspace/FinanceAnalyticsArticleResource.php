<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinanceAnalyticsArticleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'article_id' => data_get($this->resource, 'article_id'),
            'name' => (string) data_get($this->resource, 'name'),
            'type' => (string) data_get($this->resource, 'type'),
            'distribution_method' => (string) data_get($this->resource, 'distribution_method'),
            'own_amount' => (int) data_get($this->resource, 'own_amount', 0),
            'children_amount' => (int) data_get($this->resource, 'children_amount', 0),
            'amount' => (int) data_get($this->resource, 'amount', 0),
            'percent' => (float) data_get($this->resource, 'percent', 0),
            'children' => self::collection(collect(data_get($this->resource, 'children', [])))->resolve($request),
        ];
    }
}
