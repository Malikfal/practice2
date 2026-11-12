<?php

namespace App\Services\Workspace\FinancialResultServices;

use App\Repositories\Workspace\FinancialResultRepositories\FinancialResultRepository;
use App\Services\Workspace\FinancialResultServices\Data\FinancialResultFiltersData;
use App\Services\Workspace\FinancialResultServices\Reports\FinancialResultReportService;

/** Публичная граница самостоятельного отчёта о финансовых результатах. */
class FinancialResultService
{
    public function __construct(
        private readonly FinancialResultRepository $repository,
        private readonly FinancialResultFilterService $filters,
        private readonly FinancialResultBuilder $builder,
        private readonly FinancialResultReportService $reports,
    ) {}

    public function overview(array $data, string $companyId): array
    {
        return $this->reports->overview($this->build($data, $companyId));
    }

    public function projects(array $data, string $companyId): array
    {
        return $this->reports->projects($this->build($data, $companyId));
    }

    public function managers(array $data, string $companyId): array
    {
        return $this->reports->managers($this->build($data, $companyId));
    }

    public function clients(array $data, string $companyId): array
    {
        return $this->reports->clients($this->build($data, $companyId));
    }

    private function build(array $data, string $companyId): Data\FinancialResultData
    {
        return $this->builder->build($this->normalize($data, $companyId), $companyId);
    }

    /** Явный период не требует дополнительного запроса за границами данных. */
    private function normalize(array $data, string $companyId): FinancialResultFiltersData
    {
        $timezone = $this->repository->timezoneForCompany($companyId);

        if (isset($data['from'], $data['to'])) {
            return $this->filters->fromArray($data, timezone: $timezone);
        }

        [$from, $to] = $this->repository->periodBounds($companyId, $timezone);

        return $this->filters->fromArray($data, $from, $to, $timezone);
    }
}
