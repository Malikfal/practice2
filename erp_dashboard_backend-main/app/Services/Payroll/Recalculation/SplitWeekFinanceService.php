<?php

namespace App\Services\Payroll\Recalculation;

use App\Services\Payroll\Distribution\Data\PayrollProjectAllocation;
use App\Services\Payroll\Distribution\PayrollProjectDistributionService;
use App\Services\Payroll\Finance\Data\PayrollFinanceRow;
use Illuminate\Support\Collection;

final class SplitWeekFinanceService
{
    public function __construct(
        private readonly PayrollProjectDistributionService $distribution,
    ) {}

    /**
     * Рассчитывает остаток второй части недели без увеличения недельного итога.
     *
     * Проектные разницы используются как веса, но сумма результата по статье
     * ограничена разницей между итогом полной недели и уже закрытой первой частью.
     *
     * @param  Collection<int, PayrollFinanceRow>  $fullWeekRows
     * @param  Collection<int, PayrollFinanceRow>  $previousRows
     * @return Collection<int, PayrollFinanceRow>
     */
    public function remaining(Collection $fullWeekRows, Collection $previousRows): Collection
    {
        $previousByKey = $previousRows->keyBy(
            static fn (PayrollFinanceRow $row): string => $row->key(),
        );
        $previousByArticle = $previousRows->groupBy(
            fn (PayrollFinanceRow $row): string => $this->articleKey($row->financeArticleId),
        );

        return $fullWeekRows
            ->groupBy(fn (PayrollFinanceRow $row): string => $this->articleKey($row->financeArticleId))
            ->flatMap(function (Collection $articleRows, string $articleKey) use (
                $previousByKey,
                $previousByArticle,
            ): Collection {
                /** @var PayrollFinanceRow $first */
                $first = $articleRows->first();
                $remainingAmount = max(
                    0,
                    (int) $articleRows->sum('amount')
                        - (int) $previousByArticle->get($articleKey, collect())->sum('amount'),
                );

                // если у меня по проету осталось 0, то я не могу распределять остаток, так как выйду за пределы по ставкам
                if ($remainingAmount === 0) {
                    return collect();
                }

                // Положительные проектные разницы показывают, куда направить остаток.
                // здесь дифицыты используются как веса
                $projectDeficits = $articleRows
                    ->map(static function (PayrollFinanceRow $row) use ($previousByKey): object {
                        $previousAmount = (int) ($previousByKey->get($row->key())?->amount ?? 0);

                        return (object) [
                            'project_id' => $row->projectId,
                            'duration_seconds' => max(0, $row->amount - $previousAmount),
                        ];
                    })
                    ->filter(static fn (object $row): bool => $row->duration_seconds > 0)
                    ->values();

                // здесь считаю новое распределение по проектам, но ограничиваю его суммой оставшейся части, и веса с задавал из разницы выплаты по проектам
                return $this->distribution
                    ->distribute($remainingAmount, $projectDeficits)
                    ->map(static fn (PayrollProjectAllocation $allocation): PayrollFinanceRow => new PayrollFinanceRow(
                        financeArticleId: $first->financeArticleId,
                        projectId: $allocation->projectId,
                        amount: $allocation->amount,
                    ));
            })
            ->values();
    }

    /** Возвращает ключ группы финансовой статьи, включая отсутствие статьи. */
    private function articleKey(?string $financeArticleId): string
    {
        return $financeArticleId ?? '__none_article__';
    }
}
