<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Unaccounted;

use App\Enums\FinanceType;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\DistributionWeightsService;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\PeriodDistributionService;
use Illuminate\Support\Collection;

/** Страницы неучтённых платежей рассчитываются независимо от общего кэша отчёта. */
class UnaccountedPaymentsService
{
    public function __construct(
        private readonly FinanceAnalyticsOperationRepository $repository,
        private readonly DistributionWeightsService $weights,
        private readonly PeriodDistributionService $periods,
    ) {}

    /** У двух направлений независимые страницы, но один период отчёта. */
    public function pages(FinanceAnalyticsFiltersData $filters, string $companyId, int $incomePage, int $expensePage, int $perPage): Collection
    {
        return collect([
            FinanceType::ENTRANCE->value => $this->page($filters, $companyId, FinanceType::ENTRANCE, $incomePage, $perPage),
            FinanceType::EXPENDITURE->value => $this->page($filters, $companyId, FinanceType::EXPENDITURE, $expensePage, $perPage),
        ]);
    }

    /**
     * Сначала считает относящуюся к окну долю каждого платежа, поэтому total не зависит от страницы.
     * Пагинация применяется после распределения: платеж с нулевой долей не занимает место в выдаче.
     */
    private function page(FinanceAnalyticsFiltersData $filters, string $companyId, FinanceType $type, int $page, int $perPage): array
    {
        $finances = $this->repository->unaccountedPayments($companyId, $filters->from, $filters->to, $type);
        $weights = new DistributionWeightsData(
            volume: $this->weights->buildWorkTimeBasis($finances, $companyId, $filters->timezone),
        );
        $offset = ($page - 1) * $perPage;
        /** @var Collection<int, array{id: string, category: string, description: string, amount: int}> $items */
        $items = collect();
        $total = 0;
        $count = 0;
        foreach ($finances as $finance) {
            $amount = (int) $this->periods->amountBuckets($finance, $filters->from, $filters->to, weights: $weights)->sum();
            if ($amount <= 0) {
                continue;
            }
            $total += $amount;
            $count++;
            if ($count > $offset && $items->count() < $perPage) {
                $items->push([
                    'id' => (string) $finance->id,
                    'category' => trim((string) $finance->article_name) ?: 'Без статьи',
                    'description' => trim((string) $finance->comment) ?: 'Без описания',
                    'amount' => $amount,
                ]);
            }
        }

        return [
            'items' => $items->all(),
            'total' => $total,
            'total_count' => $count,
            'page' => $page,
            'per_page' => $perPage,
            'total_pages' => max(1, (int) ceil($count / $perPage)),
        ];
    }
}
