<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Actual\Data;

use App\Models\Finance;
use App\Models\Project;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use Illuminate\Support\Collection;

/** Исходные данные отчёта. Этапы расчёта читают их, но не используют как накопитель. */
final readonly class AnalyticsInputData
{
    /**
     * @param  Collection<int, Finance>  $finances
     * @param  Collection<string, Project>  $projects
     * @param  Collection<string, Project>  $allocationProjects
     */
    public function __construct(
        public string $companyId,
        public FinanceAnalyticsFiltersData $filters,
        public Collection $finances,
        public Collection $projects,
        public Collection $allocationProjects,
    ) {}

    /** Прямые операции вне выбранных проектов не должны попадать в отфильтрованную сводку. */
    public function includes(?string $projectId): bool
    {
        return $projectId ? $this->projects->has($projectId) : ! $this->filters->isScoped();
    }
}
