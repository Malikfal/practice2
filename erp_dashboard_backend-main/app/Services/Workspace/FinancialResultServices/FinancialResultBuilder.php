<?php

namespace App\Services\Workspace\FinancialResultServices;

use App\Repositories\Workspace\FinancialResultRepositories\FinancialResultRepository;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultData;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultFiltersData;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultInputData;
use App\Services\Workspace\FinancialResultServices\Reports\FinancialResultReportService;

/** Загружает исходные данные и запускает единый расчёт для всех разрезов отчёта. */
class FinancialResultBuilder
{
    public function __construct(
        private readonly FinancialResultRepository $repository,
        private readonly FinancialResultReportService $reports,
    ) {}

    public function build(FinancialResultFiltersData $filters, string $companyId): FinancialResultData
    {
        $projects = $this->repository->projects($companyId, $filters);
        $input = new FinancialResultInputData(
            filters: $filters,
            projects: $projects,
            finances: $this->repository->finances($companyId, $filters, $projects->keys()),
            articles: $this->repository->articles($companyId),
        );

        return $this->reports->build($input);
    }
}
