<?php

namespace App\Repositories\Workspace;

use App\Models\PlannedExpense;
use Illuminate\Support\Collection;

class PlannedExpenseRepository
{
    public function all(string $companyId): Collection
    {
        return PlannedExpense::query()
            ->with('article:id,name,type')
            ->where('company_id', $companyId)
            ->orderByDesc('is_active')
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Summary of active
     * @param string $companyId
     * @return \Illuminate\Database\Eloquent\Collection<int, PlannedExpense>
     */
    public function active(string $companyId): Collection
    {
        return PlannedExpense::query()
            ->with('article:id,name,type')
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->get();
    }

    public function create(array $attributes): PlannedExpense
    {
        return PlannedExpense::create($attributes)->load('article:id,name,type');
    }

    public function update(PlannedExpense $plannedExpense, array $attributes): PlannedExpense
    {
        $plannedExpense->update($attributes);

        return $plannedExpense->fresh()->load('article:id,name,type');
    }
}
