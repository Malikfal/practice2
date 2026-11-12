<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinanceAnalyticsOverviewResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'filters' => $this->filters(),
            'summary' => [
                'income' => (int) data_get($this->resource, 'summary.income', 0),
                'actual_expenses' => (int) data_get($this->resource, 'summary.actual_expenses', 0),
                'planned_expenses' => (int) data_get($this->resource, 'summary.planned_expenses', 0),
                'company_planned_expenses' => (int) data_get($this->resource, 'summary.company_planned_expenses', 0),
                'planned_expenses_included' => (bool) data_get($this->resource, 'summary.planned_expenses_included', true),
                'expenses' => (int) data_get($this->resource, 'summary.expenses', 0),
                'profit' => (int) data_get($this->resource, 'summary.profit', 0),
            ],
            'histogram' => collect(data_get($this->resource, 'histogram', []))
                ->map(static fn (mixed $bucket): array => [
                    'date' => (string) data_get($bucket, 'date'),
                    'label' => (string) data_get($bucket, 'label'),
                    'income' => (int) data_get($bucket, 'income', 0),
                    'actual_expenses' => (int) data_get($bucket, 'actual_expenses', 0),
                    'planned_expenses' => (int) data_get($bucket, 'planned_expenses', 0),
                    'expenses' => (int) data_get($bucket, 'expenses', 0),
                    'profit' => (int) data_get($bucket, 'profit', 0),
                ])
                ->values()
                ->all(),
            'income_articles' => FinanceAnalyticsArticleResource::collection(
                collect(data_get($this->resource, 'income_articles', [])),
            )->resolve($request),
            'expense_articles' => FinanceAnalyticsArticleResource::collection(
                collect(data_get($this->resource, 'expense_articles', [])),
            )->resolve($request),
            'planned_expense_articles' => FinanceAnalyticsArticleResource::collection(
                collect(data_get($this->resource, 'planned_expense_articles', [])),
            )->resolve($request),
            'distribution_warnings' => collect(data_get($this->resource, 'distribution_warnings', []))
                ->map(static fn (mixed $warning): array => [
                    'finance_id' => (string) data_get($warning, 'finance_id'),
                    'article_id' => data_get($warning, 'article_id') !== null
                        ? (string) data_get($warning, 'article_id')
                        : null,
                    'article_name' => data_get($warning, 'article_name') !== null
                        ? (string) data_get($warning, 'article_name')
                        : null,
                    'distribution_method' => (string) data_get($warning, 'distribution_method'),
                    'reason' => (string) data_get($warning, 'reason'),
                ])
                ->values()
                ->all(),
            'undistributed_expenses' => (int) data_get($this->resource, 'undistributed_expenses', 0),
            'unaccounted_income' => $this->unaccountedPayments('unaccounted_income'),
            'unaccounted_expenses' => $this->unaccountedPayments('unaccounted_expenses'),
        ];
    }

    private function unaccountedPayments(string $key): array
    {
        return [
            'items' => collect(data_get($this->resource, $key.'.items', []))
                ->map(static fn (mixed $payment): array => [
                    'id' => (string) data_get($payment, 'id'),
                    'category' => (string) data_get($payment, 'category'),
                    'description' => (string) data_get($payment, 'description'),
                    'amount' => (int) data_get($payment, 'amount', 0),
                ])
                ->values()
                ->all(),
            'total' => (int) data_get($this->resource, $key.'.total', 0),
            'total_count' => (int) data_get($this->resource, $key.'.total_count', 0),
            'page' => (int) data_get($this->resource, $key.'.page', 1),
            'per_page' => (int) data_get($this->resource, $key.'.per_page', 10),
            'total_pages' => (int) data_get($this->resource, $key.'.total_pages', 1),
        ];
    }

    private function filters(): array
    {
        return [
            'from' => (string) data_get($this->resource, 'filters.from'),
            'to' => (string) data_get($this->resource, 'filters.to'),
            'granularity' => (string) data_get($this->resource, 'filters.granularity', 'day'),
            'project_ids' => collect(data_get($this->resource, 'filters.project_ids', []))->values()->all(),
            'client_ids' => collect(data_get($this->resource, 'filters.client_ids', []))->values()->all(),
            'manager_ids' => collect(data_get($this->resource, 'filters.manager_ids', []))->values()->all(),
        ];
    }
}
