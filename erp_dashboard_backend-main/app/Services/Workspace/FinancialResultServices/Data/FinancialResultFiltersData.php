<?php

namespace App\Services\Workspace\FinancialResultServices\Data;

use App\Enums\FinanceAnalyticsGranularity;
use Carbon\Carbon;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Collection;

/** Проверенные фильтры отчёта о финансовых результатах. */
final readonly class FinancialResultFiltersData implements Arrayable
{
    /**
     * @param  Collection<int, string>  $projectIds
     * @param  Collection<int, string>  $clientIds
     * @param  Collection<int, string>  $managerIds
     * @param  Collection<int, string>  $articleIds
     * @param  Collection<int, string>  $sources
     * @param  Collection<int, string>  $employeeIds
     */
    public function __construct(
        public Carbon $from,
        public Carbon $to,
        public FinanceAnalyticsGranularity $granularity,
        public string $timezone,
        public Collection $projectIds,
        public Collection $clientIds,
        public Collection $managerIds,
        public Collection $articleIds,
        public Collection $sources,
        public Collection $employeeIds,
    ) {}

    /**
     * @return array<string, string|list<string>>
     */
    public function toArray(): array
    {
        return [
            'from' => $this->from->toDateString(),
            'to' => $this->to->toDateString(),
            'granularity' => $this->granularity->value,
            'project_ids' => $this->projectIds->all(),
            'client_ids' => $this->clientIds->all(),
            'manager_ids' => $this->managerIds->all(),
            'finance_article_ids' => $this->articleIds->all(),
            'sources' => $this->sources->all(),
            'employee_ids' => $this->employeeIds->all(),
        ];
    }
}
