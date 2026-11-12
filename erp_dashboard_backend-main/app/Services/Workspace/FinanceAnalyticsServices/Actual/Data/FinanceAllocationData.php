<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Actual\Data;

use App\Models\Finance;
use Illuminate\Support\Collection;

/** Часть операции с окончательными временными долями и назначением в проект. */
final readonly class FinanceAllocationData
{
    /** @param  Collection<string, int>  $buckets */
    public function __construct(
        public Finance $finance,
        public Collection $buckets,
        public ?string $projectId,
        public bool $allocated = false,
        public bool $undistributed = false,
    ) {}

    /** Итог выводится из долей, чтобы две копии одной суммы не могли разойтись. */
    public function amount(): int
    {
        return (int) $this->buckets->sum();
    }
}
