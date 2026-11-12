<?php

namespace App\Services\Workspace;

use App\Enums\UserRole;
use App\Models\Company;
use App\Models\User;
use App\Repositories\Workspace\EmployeeRepository;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Repositories\Workspace\PayrollRepositories\PayrollDurationRepository;
use App\Services\Payroll\Calculation\Rates\Types\CompanyHourlyPayrollService;
use App\Support\CurrentDay;
use App\Support\CurrentWeek;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class EmployeeService
{
    public function __construct(
        private readonly EmployeeRepository $employees,
        private readonly PayrollDurationRepository $payrollDurations,
        private readonly EmployeeRateRepository $rates,
        private readonly CompanyHourlyPayrollService $companyHourlyPayroll,
    ) {}

    public function paginate(array $data, string $companyId): LengthAwarePaginator
    {
        $employees = $this->employees->paginate(
            $companyId,
            $data['status'] ?? 'active',
            trim((string) ($data['search'] ?? '')),
            (int) ($data['per_page'] ?? 20),
            $data['sort_by'] ?? null,
            $data['sort_direction'] ?? 'asc',
        );

        $company = Company::query()->find($companyId);

        if ($company && $employees->isNotEmpty()) {
            $this->attachSupervisedSeconds($employees, $company);
            $this->attachCompanySeconds($employees, $company);
        }

        return $employees;
    }

    /**
     * Часы под контролем за неделю и за день по тем же правилам, что в расчёте ФОТ менеджера.
     */
    private function attachSupervisedSeconds(LengthAwarePaginator $employees, Company $company): void
    {
        $companyId = (string) $company->id;
        [$weekFrom, $weekTo] = CurrentWeek::bounds($companyId);
        [$dayFrom, $dayTo] = CurrentDay::bounds($companyId);
        $week = $this->payrollDurations->supervisedSecondsByEmployee($company, $weekFrom, $weekTo);
        $day = $this->payrollDurations->supervisedSecondsByEmployee($company, $dayFrom, $dayTo);

        $employees->getCollection()->each(function (User $employee) use ($week, $day): void {
            $id = (string) $employee->id;
            $isManager = $employee->resolvedRoleValue() === UserRole::MANAGER->value
                || $week->has($id)
                || $day->has($id);

            if (! $isManager) {
                return;
            }

            $employee->supervised_seconds_for_week = (int) ($week[$id] ?? 0);
            $employee->supervised_seconds_for_day = (int) ($day[$id] ?? 0);
        });
    }

    /**
     * Часы всей компании за неделю и за день для сотрудников, у которых на сегодня задана
     * ставка за часы всей компании. Часы те же, что CompanyHourlyPayrollService берёт для начисления.
     */
    private function attachCompanySeconds(LengthAwarePaginator $employees, Company $company): void
    {
        $companyId = (string) $company->id;
        [$dayFrom, $dayTo] = CurrentDay::bounds($companyId);
        $rates = $this->rates->ratesForDate(
            $employees->getCollection()->map(static fn (User $employee): string => (string) $employee->id)->values(),
            $dayFrom,
        );
        $eligibleIds = $rates
            ->filter(fn ($rate): bool => $this->companyHourlyPayroll->isConfigured($rate))
            ->keys();

        if ($eligibleIds->isEmpty()) {
            return;
        }

        [$weekFrom, $weekTo] = CurrentWeek::bounds($companyId);
        // Часы компании одинаковы для всех, поэтому считаем их один раз на страницу.
        $week = (int) $this->payrollDurations->company($company, $weekFrom, $weekTo)->sum('duration_seconds');
        $day = (int) $this->payrollDurations->company($company, $dayFrom, $dayTo)->sum('duration_seconds');

        $employees->getCollection()->each(function (User $employee) use ($eligibleIds, $week, $day): void {
            if (! $eligibleIds->contains((string) $employee->id)) {
                return;
            }

            $employee->company_seconds_for_week = $week;
            $employee->company_seconds_for_day = $day;
        });
    }
}
