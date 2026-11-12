<?php

namespace App\Services\Workspace\FinancialResultServices\Data;

use App\Models\Finance;
use App\Models\FinanceArticle;
use App\Models\Project;
use Illuminate\Support\Collection;

/** Исходные данные одного расчёта, уже ограниченные компанией и фильтрами. */
final readonly class FinancialResultInputData
{
    /**
     * @param  Collection<string, Project>  $projects
     * @param  Collection<int, Finance>  $finances
     * @param  Collection<int, FinanceArticle>  $articles
     */
    public function __construct(
        public FinancialResultFiltersData $filters,
        public Collection $projects,
        public Collection $finances,
        public Collection $articles,
    ) {}
}
