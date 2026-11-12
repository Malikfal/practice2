<?php

namespace App\Services\Workspace\FinancialResultServices\Data;

use Illuminate\Support\Collection;

/** Готовый общий результат, из которого формируются все разрезы отчёта. */
final readonly class FinancialResultData
{
    /**
     * @param  Collection<string, int>  $summary
     * @param  Collection<int, array<string, int|string>>  $histogram
     * @param  Collection<int, array<string, mixed>>  $incomeArticles
     * @param  Collection<int, array<string, mixed>>  $expenseArticles
     * @param  Collection<string, array<string, mixed>>  $projects
     */
    public function __construct(
        public FinancialResultFiltersData $filters,
        public Collection $summary,
        public Collection $histogram,
        public Collection $incomeArticles,
        public Collection $expenseArticles,
        public Collection $projects,
    ) {}
}
