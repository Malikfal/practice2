<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinancialResultOverviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'filters' => $this->filters(),
            'summary' => [
                'income' => (int) data_get($this->resource, 'summary.income', 0),
                'expenses' => (int) data_get($this->resource, 'summary.expenses', 0),
                'profit' => (int) data_get($this->resource, 'summary.profit', 0),
            ],
            'histogram' => collect(data_get($this->resource, 'histogram', []))->map(static fn (mixed $bucket): array => [
                'date' => (string) data_get($bucket, 'date'),
                'label' => (string) data_get($bucket, 'label'),
                'income' => (int) data_get($bucket, 'income', 0),
                'expenses' => (int) data_get($bucket, 'expenses', 0),
                'profit' => (int) data_get($bucket, 'profit', 0),
            ])->values()->all(),
            'income_articles' => FinancialResultArticleResource::collection(
                collect(data_get($this->resource, 'income_articles', [])),
            )->resolve($request),
            'expense_articles' => FinancialResultArticleResource::collection(
                collect(data_get($this->resource, 'expense_articles', [])),
            )->resolve($request),
        ];
    }

    private function filters(): array
    {
        return [
            'from' => (string) data_get($this->resource, 'filters.from'),
            'to' => (string) data_get($this->resource, 'filters.to'),
            'granularity' => (string) data_get($this->resource, 'filters.granularity', 'month'),
            'project_ids' => collect(data_get($this->resource, 'filters.project_ids', []))->values()->all(),
            'client_ids' => collect(data_get($this->resource, 'filters.client_ids', []))->values()->all(),
            'manager_ids' => collect(data_get($this->resource, 'filters.manager_ids', []))->values()->all(),
            'finance_article_ids' => collect(data_get($this->resource, 'filters.finance_article_ids', []))->values()->all(),
            'sources' => collect(data_get($this->resource, 'filters.sources', []))->values()->all(),
            'employee_ids' => collect(data_get($this->resource, 'filters.employee_ids', []))->values()->all(),
        ];
    }
}
