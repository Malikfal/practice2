<?php

namespace App\Services\Payroll\Finance;

use App\Models\Company;
use App\Models\User;
use App\Services\Payroll\Distribution\Data\PayrollFinanceAllocation;
use App\Services\Payroll\Finance\Data\PayrollFinanceRow;
use Illuminate\Support\Collection;

class PayrollFinancePreparationService
{
    public function __construct(
        private readonly PayrollFinanceArticleService $articles,
    ) {}

    /**
     * Выбирает статью каждого компонента и объединяет суммы одной статьи и проекта.
     *
     * @param  Collection<int, PayrollFinanceAllocation>  $allocations
     * @return Collection<int, PayrollFinanceRow>
     */
    public function prepare(Company $company, User $employee, Collection $allocations): Collection
    {
        return $allocations
            ->map(fn (PayrollFinanceAllocation $allocation): PayrollFinanceRow => new PayrollFinanceRow(
                financeArticleId: $this->articles->resolveId($company, $employee, $allocation->component),
                projectId: $allocation->projectId,
                amount: $allocation->amount,
            ))
            ->groupBy(static fn (PayrollFinanceRow $row): string => $row->key())
            ->map(static function (Collection $rows): PayrollFinanceRow {
                /** @var PayrollFinanceRow $first */
                $first = $rows->first();

                return $first->withAmount((int) $rows->sum('amount'));
            })
            ->filter(static fn (PayrollFinanceRow $row): bool => $row->amount > 0)
            ->values();
    }
}
