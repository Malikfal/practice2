<?php

namespace App\Repositories\Workspace;

use App\Enums\FinanceType;
use App\Models\Finance;
use App\Models\FinanceArticle;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class FinanceRepository
{
    private const RELATIONS = ['project.client', 'article.childrenRecursive', 'employee'];

    public function paginate(string $companyId, array $filters, int $perPage): LengthAwarePaginator
    {
        return $this->filteredQuery($companyId, $filters)
            ->orderByDesc('dateOfPayment')
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->withQueryString();
    }

    public function all(string $companyId, array $filters): Collection
    {
        return $this->filteredQuery($companyId, $filters)
            ->orderByDesc('dateOfPayment')
            ->orderByDesc('created_at')
            ->get();
    }

    /** @return array{income: int, expenses: int, profit: int} */
    public function summary(string $companyId, array $filters): array
    {
        $totals = $this->filteredQuery($companyId, $filters)
            ->toBase()
            ->selectRaw(
                'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS income, '
                .'COALESCE(SUM(CASE WHEN type = ? THEN amount ELSE 0 END), 0) AS expenses',
                [FinanceType::ENTRANCE->value, FinanceType::EXPENDITURE->value],
            )
            ->first();

        $income = (int) ($totals->income ?? 0);
        $expenses = (int) ($totals->expenses ?? 0);

        return [
            'income' => $income,
            'expenses' => $expenses,
            'profit' => $income - $expenses,
        ];
    }

    public function create(array $attributes): Finance
    {
        return Finance::create($attributes)->load(self::RELATIONS);
    }

    public function update(Finance $finance, array $attributes): Finance
    {
        $finance->update($attributes);

        return $finance->fresh()->load(self::RELATIONS);
    }

    public function articles(string $companyId, array $filters): Collection
    {
        return FinanceArticle::query()
            ->with(['childrenRecursive'])
            ->where('company_id', $companyId)
            ->whereNull('parent_id')
            ->when($filters['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->orderBy('name')
            ->get();
    }

    public function createArticle(array $attributes): FinanceArticle
    {
        return FinanceArticle::create($attributes)->load(['childrenRecursive']);
    }

    public function updateArticle(FinanceArticle $article, array $attributes): FinanceArticle
    {
        $article->update($attributes);

        return $article->fresh()->load(['childrenRecursive']);
    }

    private function filteredQuery(string $companyId, array $filters): Builder
    {
        $from = isset($filters['from']) ? (string) $filters['from'] : null;
        $to = isset($filters['to']) ? (string) $filters['to'] : null;

        return Finance::query()
            ->with(self::RELATIONS)
            ->where('company_id', $companyId)
            ->when($from, fn (Builder $query, string $value) => $query->where('dateOfPayment', '>=', $value))
            ->when($to, fn (Builder $query, string $value) => $query->where('dateOfPayment', '<=', $value))
            ->when($filters['type'] ?? null, fn (Builder $query, string $type) => $query->where('type', $type))
            ->when($filters['sources'] ?? [], fn (Builder $query, array $sources) => $query->whereIn('source', $sources))
            ->when($filters['finance_article_ids'] ?? [], fn (Builder $query, array $articleIds) => $query->whereIn('finance_article_id', $articleIds))
            ->when($filters['project_ids'] ?? [], fn (Builder $query, array $projectIds) => $query->whereIn('project_id', $projectIds))
            ->when($filters['client_ids'] ?? [], fn (Builder $query, array $clientIds) => $query->whereHas(
                'project',
                fn (Builder $projectQuery) => $projectQuery->whereIn('client_id', $clientIds),
            ))
            ->when(isset($filters['amount_from']), fn (Builder $query) => $query->where('amount', '>=', (int) $filters['amount_from']))
            ->when(isset($filters['amount_to']), fn (Builder $query) => $query->where('amount', '<=', (int) $filters['amount_to']))
            ->when($filters['employee_ids'] ?? [], fn (Builder $query, array $employeeIds) => $query->whereIn('employee_id', $employeeIds));
    }
}
