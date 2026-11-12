<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Planned\Data;

use Illuminate\Support\Collection;

/** План компании до применения фильтра проектов; в фактические распределения он не входит. */
final readonly class PlannedExpensesData
{
    /**
     * @param  Collection<string, int>  $buckets
     * @param  Collection<string, int>  $articles
     */
    public function __construct(public Collection $buckets, public Collection $articles) {}

    /** Общая сумма всегда выводится из рассчитанных временных долей. */
    public function total(): int
    {
        return (int) $this->buckets->sum();
    }
}
