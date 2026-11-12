<?php

namespace App\Services\Workspace;

use App\Enums\FinanceType;
use App\Enums\PlannedExpenseFormula;
use App\Models\FinanceArticle;
use App\Models\PlannedExpense;
use App\Repositories\Workspace\PlannedExpenseRepository;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsService;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PlannedExpenseService
{
    public function __construct(
        private readonly PlannedExpenseRepository $plannedExpenses,
        private readonly FinanceAnalyticsService $financeAnalytics,
        private readonly FinanceAnalyticsCacheService $analyticsCache,
    ) {}

    public function all(string $companyId): Collection
    {
        return $this->plannedExpenses->all($companyId);
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function payments(array $filters, string $companyId): Collection
    {
        if (
            ($filters['type'] ?? null) === FinanceType::ENTRANCE->value
            || $this->hasScopedFilters($filters)
        ) {
            return collect();
        }

        [$windowFrom, $windowTo] = $this->paymentWindow($filters);
        $articleIds = array_map('strval', $filters['finance_article_ids'] ?? []);
        $amountFrom = isset($filters['amount_from']) ? (int) $filters['amount_from'] : null;
        $amountTo = isset($filters['amount_to']) ? (int) $filters['amount_to'] : null;
        $incomes = [];
        $rows = [];
        $today = now()->startOfDay();
        $hasDateFilters = ! empty($filters['from']) || ! empty($filters['to']);

        foreach ($this->plannedExpenses->active($companyId) as $plannedExpense) {
            $articleId = (string) $plannedExpense->finance_article_id;

            if ($articleIds !== [] && ! in_array($articleId, $articleIds, true)) {
                continue;
            }

            [$periodFrom, $periodTo] = $plannedExpense->calculation_period->bounds($today);
            [$expenseWindowFrom, $expenseWindowTo] = $hasDateFilters
                ? [$windowFrom, $windowTo]
                : [$periodFrom, $periodTo];
            $distributionFrom = $periodFrom->copy()->max($expenseWindowFrom);
            $distributionTo = $periodTo->copy()->min($expenseWindowTo);

            if ($distributionFrom->gt($distributionTo)) {
                continue;
            }

            $income = null;
            if ($plannedExpense->formula === PlannedExpenseFormula::PERCENT_OF_INCOME) {
                $incomeArticleIds = $this->incomeArticleIds($plannedExpense);
                $periodKey = $periodFrom->toDateString().':'.$periodTo->toDateString()
                    .':'.implode(',', $incomeArticleIds);
                $income = $incomes[$periodKey] ??= $this->financeAnalytics->incomeForPeriod(
                    $periodFrom,
                    $periodTo,
                    $companyId,
                    $incomeArticleIds,
                );
            }

            // Фильтр списка выбирает видимую долю уже рассчитанного плана, а не меняет его базовую сумму.
            $amount = $this->amountForOverlap(
                $plannedExpense->calculateAmount($income),
                $periodFrom,
                $periodTo,
                $distributionFrom,
                $distributionTo,
            );

            if (($amountFrom !== null && $amount < $amountFrom) || ($amountTo !== null && $amount > $amountTo)) {
                continue;
            }

            $rows[] = [
                'id' => 'planned:'.$plannedExpense->id.':'.$periodFrom->toDateString(),
                'is_planned' => true,
                'planned_expense_id' => (string) $plannedExpense->id,
                'type' => FinanceType::EXPENDITURE->value,
                'type_label' => FinanceType::EXPENDITURE->label(),
                'amount' => $amount,
                'income_amount' => $income,
                'percentage' => $plannedExpense->percentage !== null
                    ? (float) $plannedExpense->percentage
                    : null,
                'fixed_amount' => $plannedExpense->fixed_amount !== null
                    ? (int) $plannedExpense->fixed_amount
                    : null,
                'formula_label' => $plannedExpense->formula->label(),
                'calculation_period' => $plannedExpense->calculation_period->value,
                'calculation_period_label' => $plannedExpense->calculation_period->label(),
                'period_from' => $distributionFrom->toDateString(),
                'period_to' => $distributionTo->toDateString(),
                'article' => [
                    'id' => $articleId,
                    'name' => (string) $plannedExpense->article?->name,
                ],
            ];
        }

        return collect($rows)
            ->sortByDesc(fn (array $row): string => $row['period_to'].':'.$row['article']['name'])
            ->values();
    }

    public function create(array $data, string $companyId): PlannedExpense
    {
        $this->assertExpenseArticle((string) $data['finance_article_id'], $companyId);
        $this->assertIncomeArticles($data['income_article_ids'] ?? [], $companyId);

        $plannedExpense = $this->plannedExpenses->create([
            'id' => (string) Str::uuid(),
            'company_id' => $companyId,
            ...$this->attributes($data),
        ]);

        $this->analyticsCache->invalidateCompany($companyId);

        return $plannedExpense;
    }

    public function show(PlannedExpense $plannedExpense, string $companyId): PlannedExpense
    {
        $this->assertCompany($plannedExpense, $companyId);

        return $plannedExpense->load('article:id,name,type');
    }

    public function update(PlannedExpense $plannedExpense, array $data, string $companyId): PlannedExpense
    {
        $this->assertCompany($plannedExpense, $companyId);
        $this->assertExpenseArticle((string) $data['finance_article_id'], $companyId);
        $this->assertIncomeArticles($data['income_article_ids'] ?? [], $companyId);

        $updatedPlannedExpense = $this->plannedExpenses->update($plannedExpense, $this->attributes($data));

        $this->analyticsCache->invalidateCompany($companyId);

        return $updatedPlannedExpense;
    }

    public function delete(PlannedExpense $plannedExpense, string $companyId): void
    {
        $this->assertCompany($plannedExpense, $companyId);
        $plannedExpense->delete();
        $this->analyticsCache->invalidateCompany($companyId);
    }

    private function attributes(array $data): array
    {
        return [
            'finance_article_id' => $data['finance_article_id'],
            'formula' => $data['formula'],
            'percentage' => $data['formula'] === PlannedExpenseFormula::PERCENT_OF_INCOME->value
                ? $data['percentage']
                : null,
            'fixed_amount' => $data['formula'] === PlannedExpenseFormula::FIXED_AMOUNT->value
                ? $data['fixed_amount']
                : null,
            'income_article_ids' => $data['formula'] === PlannedExpenseFormula::PERCENT_OF_INCOME->value
                ? array_values(array_unique(array_map('strval', $data['income_article_ids'] ?? [])))
                : [],
            'calculation_period' => $data['calculation_period'],
            'is_active' => (bool) $data['is_active'],
        ];
    }

    private function amountForOverlap(
        int $amount,
        Carbon $periodFrom,
        Carbon $periodTo,
        Carbon $overlapFrom,
        Carbon $overlapTo,
    ): int {
        if ($amount <= 0 || $overlapFrom->gt($overlapTo)) {
            return 0;
        }

        $periodDays = (int) $periodFrom->copy()->startOfDay()
            ->diffInDays($periodTo->copy()->startOfDay()) + 1;
        $overlapDays = (int) $overlapFrom->copy()->startOfDay()
            ->diffInDays($overlapTo->copy()->startOfDay()) + 1;

        return (int) round($amount * $overlapDays / $periodDays);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array{0: Carbon, 1: Carbon}
     */
    private function paymentWindow(array $filters): array
    {
        if (! empty($filters['from'])) {
            $from = Carbon::parse((string) $filters['from'])->startOfDay();
        } elseif (! empty($filters['to'])) {
            $from = Carbon::parse((string) $filters['to'])->startOfMonth();
        } else {
            $from = now()->startOfMonth();
        }

        if (! empty($filters['to'])) {
            $to = Carbon::parse((string) $filters['to'])->endOfDay();
        } elseif (! empty($filters['from'])) {
            $to = Carbon::parse((string) $filters['from'])->endOfMonth();
        } else {
            $to = now()->endOfMonth();
        }

        if ($to->lt($from)) {
            return [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function hasScopedFilters(array $filters): bool
    {
        return ($filters['project_ids'] ?? []) !== []
            || ($filters['client_ids'] ?? []) !== []
            || ($filters['employee_ids'] ?? []) !== [];
    }

    private function assertExpenseArticle(string $articleId, string $companyId): void
    {
        $exists = FinanceArticle::query()
            ->whereKey($articleId)
            ->where('company_id', $companyId)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'finance_article_id' => ['Выбранная статья расходов недоступна.'],
            ]);
        }
    }

    /**
     * @param  list<string>  $articleIds
     */
    private function assertIncomeArticles(array $articleIds, string $companyId): void
    {
        $articleIds = array_values(array_unique(array_map('strval', $articleIds)));

        if ($articleIds === []) {
            return;
        }

        $existingCount = FinanceArticle::query()
            ->whereIn('id', $articleIds)
            ->where('company_id', $companyId)
            ->where('type', FinanceType::ENTRANCE->value)
            ->count();

        if ($existingCount !== count($articleIds)) {
            throw ValidationException::withMessages([
                'income_article_ids' => ['Одна или несколько статей поступлений недоступны.'],
            ]);
        }
    }

    /**
     * @return list<string>
     */
    private function incomeArticleIds(PlannedExpense $plannedExpense): array
    {
        $articleIds = array_values(array_unique(array_map(
            'strval',
            is_array($plannedExpense->income_article_ids) ? $plannedExpense->income_article_ids : [],
        )));
        sort($articleIds);

        return $articleIds;
    }

    private function assertCompany(PlannedExpense $plannedExpense, string $companyId): void
    {
        if ((string) $plannedExpense->company_id !== $companyId) {
            throw new NotFoundHttpException;
        }
    }
}
