<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Actual;

use App\Enums\FinanceAllocationKind;
use App\Enums\FinanceArticleDistributionMethod as Method;
use App\Enums\FinanceType;
use App\Models\Finance;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\ActualAnalyticsData;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\AnalyticsInputData;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\FinanceAllocationData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\AmountAllocator;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data\DistributionWeightsData;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\DistributionWeightsService;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\PeriodDistributionService;
use App\Services\Workspace\FinanceAnalyticsServices\Distribution\ProjectDistributionService;
use Illuminate\Support\Collection;

/** Классификация и распределение фактических платежей за один проход. */
class ActualFinanceService
{
    public function __construct(
        private readonly DistributionWeightsService $weights,
        private readonly PeriodDistributionService $periods,
        private readonly ProjectDistributionService $projects,
        private readonly AmountAllocator $allocator,
    ) {}

    /** Возвращает самостоятельный результат; сводка, статьи и проектные строки здесь не изменяются. */
    public function calculate(AnalyticsInputData $input): ActualAnalyticsData
    {
        // Общие базы расходов и часов загружаются один раз для всех операций.
        $weights = $this->weights->buildForFinances($input->finances, $input->companyId, $input->filters->timezone);
        /** @var Collection<int, FinanceAllocationData> $allocations */
        $allocations = collect();
        /** @var Collection<int, array{finance_id: string, article_id: string|null, article_name: string|null, distribution_method: string, reason: string}> $warnings */
        $warnings = collect();

        foreach ($input->finances as $finance) {
            if ($finance->amount <= 0) {
                continue;
            }

            $kind = $this->allocationKind($finance, $input);
            if ($kind === FinanceAllocationKind::EXCLUDED) {
                continue;
            }

            // При отсутствии нужной базы сумма сохранится через равномерное распределение.
            if ($kind !== FinanceAllocationKind::UNDISTRIBUTED || ! $input->filters->isScoped()) {
                $warning = $this->periods->missingWeightsWarning($finance, $weights, $input->filters->timezone);
                if ($warning !== null) {
                    $warnings->push($warning);
                }
            }

            $buckets = $this->periods->amountBuckets(
                $finance,
                $input->filters->from,
                $input->filters->to,
                $input->filters->granularity,
                $weights,
            );
            if ($buckets->sum() <= 0) {
                continue;
            }

            if ($kind === FinanceAllocationKind::DISTRIBUTED) {
                foreach ($this->allocateAcrossProjects($finance, $buckets, $input, $weights) as $allocation) {
                    $allocations->push($allocation);
                }
            } else {
                $allocations->push(new FinanceAllocationData(
                    $finance,
                    $buckets,
                    $kind === FinanceAllocationKind::DIRECT ? (string) $finance->project_id : null,
                    undistributed: $kind === FinanceAllocationKind::UNDISTRIBUTED,
                ));
            }
        }

        return new ActualAnalyticsData($allocations->values(), $warnings);
    }

    /** Определяет единственный дальнейший сценарий обработки операции. */
    private function allocationKind(Finance $finance, AnalyticsInputData $input): FinanceAllocationKind
    {
        if ($finance->project_id) {
            return $input->includes((string) $finance->project_id)
                ? FinanceAllocationKind::DIRECT
                : FinanceAllocationKind::EXCLUDED;
        }

        if ($finance->distribution_project_mode !== null
            || ($finance->type === FinanceType::EXPENDITURE && $finance->distributionMethod() === Method::PROPORTIONAL_TO_EXPENSES)) {
            return FinanceAllocationKind::DISTRIBUTED;
        }

        if ($finance->type === FinanceType::EXPENDITURE) {
            return FinanceAllocationKind::UNDISTRIBUTED;
        }

        return $input->filters->isScoped()
            ? FinanceAllocationKind::EXCLUDED
            : FinanceAllocationKind::GLOBAL;
    }

    /**
     * Распределяет видимую сумму операции по полному набору проектов и оставляет проекты текущего среза.
     *
     * @param  Collection<string, int>  $buckets
     * @return Collection<int, FinanceAllocationData>
     */
    private function allocateAcrossProjects(Finance $finance, Collection $buckets, AnalyticsInputData $input, DistributionWeightsData $weights): Collection
    {
        /** @var Collection<string, int> $projectWeights */
        $projectWeights = $this->projects->weightsForFinance($finance, $input->allocationProjects, $input->filters, $weights);
        if ($projectWeights->isEmpty()) {
            return collect([new FinanceAllocationData($finance, $buckets, null, undistributed: $finance->type === FinanceType::EXPENDITURE)]);
        }

        return $this->allocator->allocate((int) $buckets->sum(), $projectWeights)
            // Полные веса нужны округлению, но временные доли ненужных проектов можно не строить.
            ->filter(static fn (int $amount, string $projectId): bool => $amount > 0 && $input->projects->has($projectId))
            ->map(fn (int $amount, string $projectId): FinanceAllocationData => new FinanceAllocationData(
                $finance, $this->allocator->allocate($amount, $buckets->filter(static fn ($value): bool => $value > 0)), $projectId, allocated: true,
            ))->values();
    }
}
