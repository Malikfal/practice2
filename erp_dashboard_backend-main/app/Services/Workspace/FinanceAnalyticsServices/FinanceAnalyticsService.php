<?php

namespace App\Services\Workspace\FinanceAnalyticsServices;

use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsCompanyRepository;
use App\Repositories\Workspace\FinanceAnalyticsRepositories\FinanceAnalyticsOperationRepository;
use App\Services\Workspace\FinanceAnalyticsServices\Data\FinanceAnalyticsFiltersData;
use App\Services\Workspace\FinanceAnalyticsServices\Employees\EmployeeAnalyticsService;
use App\Services\Workspace\FinanceAnalyticsServices\Planned\PlannedAnalyticsService;
use App\Services\Workspace\FinanceAnalyticsServices\Reports\FinanceReportService;
use App\Services\Workspace\FinanceAnalyticsServices\Unaccounted\UnaccountedPaymentsService;
use Carbon\Carbon;

/** Граница API: нормализует вход и направляет запрос в нужный финансовый модуль. */
class FinanceAnalyticsService
{
    public function __construct(
        private readonly FinanceAnalyticsOperationRepository $operations,
        private readonly FinanceAnalyticsCompanyRepository $companies,
        private readonly FinanceAnalyticsFilterService $filters,
        private readonly FinanceAnalyticsBuilder $builder,
        private readonly FinanceReportService $reports,
        private readonly EmployeeAnalyticsService $employees,
        private readonly UnaccountedPaymentsService $unaccounted,
        private readonly PlannedAnalyticsService $planned,
    ) {}

    /** Пагинация применяется вне общего кэша, чтобы смена страницы не пересчитывала аналитику. */
    public function overview(array $data, string $companyId): array
    {
        $filters = $this->normalize($data, $companyId);
        $perPage = (int) ($data['unaccounted_per_page'] ?? 10);
        $payments = $this->unaccounted->pages($filters, $companyId,
            max(1, (int) ($data['unaccounted_income_page'] ?? 1)),
            max(1, (int) ($data['unaccounted_expenses_page'] ?? 1)), min(100, $perPage > 0 ? $perPage : 10));

        return $this->reports->overview($this->builder->build($filters, $companyId), $payments);
    }

    /** Проекты используют общий расчёт без промежуточного сервиса-переадресатора. */
    public function projects(array $data, string $companyId): array
    {
        return $this->reports->projects($this->builder->build($this->normalize($data, $companyId), $companyId));
    }

    /** Менеджеры — представление готовых проектных сумм. */
    public function managers(array $data, string $companyId): array
    {
        return $this->reports->managers($this->builder->build($this->normalize($data, $companyId), $companyId));
    }

    /** Клиенты — представление тех же проектных сумм. */
    public function clients(array $data, string $companyId): array
    {
        return $this->reports->clients($this->builder->build($this->normalize($data, $companyId), $companyId));
    }

    /** Сотрудникам нужны платежи и часы, поэтому общая сборка не вызывается. */
    public function employees(array $data, string $companyId): array
    {
        return $this->employees->build($this->normalize($data, $companyId), $companyId);
    }

    /** Публичный контракт формул плановых расходов сохраняется. */
    public function incomeForPeriod(Carbon $from, Carbon $to, string $companyId, array $articleIds = []): int
    {
        return $this->planned->incomeForPeriod($from, $to, $companyId, collect($articleIds));
    }

    /** Явный период не требует двух агрегатных запросов для вычисления значений по умолчанию. */
    private function normalize(array $data, string $companyId): FinanceAnalyticsFiltersData
    {
        $timezone = $this->companies->timezoneForCompany($companyId);

        if (isset($data['from'], $data['to'])) {
            return $this->filters->fromArray($data, timezone: $timezone);
        }

        [$from, $to] = $this->operations->periodBounds($companyId, $timezone);

        return $this->filters->fromArray($data, $from, $to, $timezone);
    }
}
