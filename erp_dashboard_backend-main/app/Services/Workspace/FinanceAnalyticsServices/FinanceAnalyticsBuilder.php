<?php

namespace App\Services\Workspace\FinanceAnalyticsServices;

use App\Models\Project;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsProjectRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\ActualFinanceService;
use App\Services\Workspace\FinanceAnalyticsServices\Actual\Data\AnalyticsInputData;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use App\Services\Workspace\FinanceAnalyticsServices\Planned\PlannedAnalyticsService;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\Data\AnalyticsResultData;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\FinanceReportService;
use Illuminate\Support\Collection;

/** Координирует законченные расчёты без общего изменяемого состояния. */
class FinanceAnalyticsBuilder
{
    public function __construct(
        private readonly FinanceAnalyticsOperationRepository $operations,
        private readonly FinanceAnalyticsProjectRepository $projects,
        private readonly FinanceAnalyticsCacheService $cache,
        private readonly ActualFinanceService $actual,
        private readonly PlannedAnalyticsService $planned,
        private readonly FinanceReportService $reports,
    ) {}

    /** Проектные разрезы разделяют один результат и одни правила округления. */
    public function build(FinanceAnalyticsFiltersData $filters, string $companyId): AnalyticsResultData
    {
        return $this->cache->remember($companyId, $filters, fn (): AnalyticsResultData => $this->buildAnalyticsCore($filters, $companyId));
    }

    /** Каждый этап возвращает собственные данные; объединение происходит один раз в конце. */
    private function buildAnalyticsCore(FinanceAnalyticsFiltersData $filters, string $companyId): AnalyticsResultData
    {
        /** @var Collection<string, Project> $projects */
        $projects = $this->projects->projects($companyId, $filters->projectIds, $filters->clientIds, $filters->managerIds)->keyBy('id');
        $input = new AnalyticsInputData(
            companyId: $companyId,
            filters: $filters,
            finances: $this->operations->finances($companyId, $filters->from, $filters->to),
            projects: $projects,
            // Для знаменателя нужны все проекты, но только ID и дата архивации, без связей.
            allocationProjects: $filters->isScoped() ? $this->projects->allocationProjects($companyId)->keyBy('id') : $projects,
        );
        $actual = $this->actual->calculate($input);
        $plannedExpenses = $this->planned->calculate($filters, $companyId);

        return $this->reports->build($input, $actual, $plannedExpenses, $this->operations->articles($companyId));
    }
}
