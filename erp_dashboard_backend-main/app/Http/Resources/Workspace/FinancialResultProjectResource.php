<?php

namespace App\Http\Resources\Workspace;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class FinancialResultProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'project' => $this->object('project'),
            'client' => $this->object('client'),
            'managers' => collect(data_get($this->resource, 'managers', []))->values()->all(),
            'income' => (int) data_get($this->resource, 'income', 0),
            'direct_expenses' => (int) data_get($this->resource, 'direct_expenses', 0),
            'employee_expenses' => (int) data_get($this->resource, 'employee_expenses', 0),
            'other_expenses' => (int) data_get($this->resource, 'other_expenses', 0),
            'expenses' => (int) data_get($this->resource, 'expenses', 0),
            'profit' => (int) data_get($this->resource, 'profit', 0),
            'employees' => collect(data_get($this->resource, 'employees', []))->map(static fn (mixed $row): array => [
                'employee' => is_array(data_get($row, 'employee')) ? data_get($row, 'employee') : null,
                'expenses' => (int) data_get($row, 'expenses', 0),
            ])->values()->all(),
            'income_articles' => collect(data_get($this->resource, 'income_articles', []))->map(static fn (mixed $row): array => [
                'article' => is_array(data_get($row, 'article')) ? data_get($row, 'article') : null,
                'income' => (int) data_get($row, 'income', 0),
            ])->values()->all(),
            'expense_articles' => collect(data_get($this->resource, 'expense_articles', []))->map(static fn (mixed $row): array => [
                'article' => is_array(data_get($row, 'article')) ? data_get($row, 'article') : null,
                'expenses' => (int) data_get($row, 'expenses', 0),
            ])->values()->all(),
        ];
    }

    private function object(string $key): ?array
    {
        $value = data_get($this->resource, $key);

        return is_array($value) ? $value : null;
    }
}
