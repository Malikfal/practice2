<?php

namespace App\Services\Payroll\Recalculation;

use App\Enums\FinanceSource;
use App\Events\PayrollPeriodRecalculated;
use App\Models\Company;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollFinanceRepository;
use App\Services\Payroll\Calculation\PayrollCalculationService;
use App\Services\Payroll\Distribution\PayrollComponentDistributionService;
use App\Services\Payroll\Finance\Data\PayrollFinanceRow;
use App\Services\Payroll\Finance\PayrollFinancePreparationService;
use App\Services\Payroll\Period\PayrollPeriod;
use App\Services\Payroll\Recalculation\Data\PayrollRecalculationResult;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class CompanyPayrollRecalculationService
{
    public function __construct(
        private readonly PayrollFinanceRepository $payrollRepository,
        private readonly PayrollCalculationService $calculations,
        private readonly PayrollComponentDistributionService $distribution,
        private readonly PayrollFinancePreparationService $financePreparation,
        private readonly SplitWeekFinanceService $splitWeekFinance,
        private readonly FinanceAnalyticsCacheService $analyticsCache,
    ) {}

    /**
     * Полностью заменяет системные начисления компании внутри расчетного периода.
     */
    public function recalculate(Company $company, PayrollPeriod $period): PayrollRecalculationResult
    {
        $result = DB::transaction(function () use ($company, $period): PayrollRecalculationResult {
            // Блокировка не дает двум перерасчетам одной компании одновременно заменить финансы.
            $lockedCompany = Company::query()->whereKey($company->id)->lockForUpdate()->firstOrFail();

            // Дневные строки предварительные: закрытие периода полностью заменяет их итоговыми.
            $deleted = $this->payrollRepository->deleteCompanyPayrollFinancesForPeriod(
                company: $lockedCompany,
                period: $period,
                sources: collect([FinanceSource::PAYROLL_DAILY, FinanceSource::PAYROLL_RECALCULATION]),
            );
            $employeesProcessed = 0;
            $amount = 0;
            $created = 0;

            User::withBlocked()
                ->where('company_id', $lockedCompany->id)
                ->orderBy('id')
                ->each(function (User $employee) use (
                    $lockedCompany,
                    $period,
                    &$employeesProcessed,
                    &$amount,
                    &$created,
                ): void {
                    // Распределение строится до сравнения с первой частью разделенной недели.
                    $financeRows = $this->financeRowsForPeriod($lockedCompany, $employee, $period);
                    if ($financeRows->isEmpty()) {
                        return;
                    }

                    $employeesProcessed++;
                    $amount += (int) $financeRows->sum('amount');

                    // После распределения готовые строки записываются как итог перерасчета.
                    $created += $this->payrollRepository->createPayrollFinanceRows(
                        company: $lockedCompany,
                        employee: $employee,
                        period: $period,
                        rows: $financeRows,
                    );
                });

            return new PayrollRecalculationResult(
                period: $period,
                employeesProcessed: $employeesProcessed,
                amount: $amount,
                deleted: $deleted,
                created: $created,
            );
        });

        $this->analyticsCache->invalidateCompany((string) $company->id);
        PayrollPeriodRecalculated::dispatch($company, $period);

        return $result;
    }

    /**
     * Возвращает итоговое распределение сотрудника для записываемой части периода.
     *
     * Для второй части недели сначала строится распределение полной недели. Затем из
     * каждой строки finance article + project вычитается такая же строка первой части.
     *
     * @return Collection<int, PayrollFinanceRow>
     */
    private function financeRowsForPeriod(Company $company, User $employee, PayrollPeriod $period): Collection
    {
        if (! $period->continuesSplitWeek()) {
            // Обычный период считается и распределяется строго в собственных границах.
            $calculation = $this->calculations->forPeriod(
                company: $company,
                employee: $employee,
                from: $period->from,
                to: $period->to,
            );

            return $this->financePreparation->prepare(
                company: $company,
                employee: $employee,
                allocations: $this->distribution->distributeComponents(
                    components: $calculation->components,
                    company: $company,
                    employee: $employee,
                ),
            );
        }

        // Вторая часть должна довести каждый проект до результата полной недели.
        $fullWeek = $this->calculations->forPeriod(
            company: $company,
            employee: $employee,
            from: $period->weekFrom(),
            to: $period->weekTo(),
        );
        $fullWeekRows = $this->financePreparation->prepare(
            company: $company,
            employee: $employee,
            allocations: $this->distribution->distributeComponents(
                components: $fullWeek->components,
                company: $company,
                employee: $employee,
            ),
        );

        // Ранее записанные финансы загружаются с той же детализацией article + project.
        $previousRows = $this->payrollRepository->payrollFinanceRowsForPeriod(
            company: $company,
            employee: $employee,
            from: $period->weekFrom(),
            to: $period->from,
            sources: collect([FinanceSource::PAYROLL_RECALCULATION]),
        );

        // проверка (кослыть, без корого нельзя) чтобы не выйти за пределы по ставкам. это нужно только для второй части недели, больше нигде это не используется
        return $this->splitWeekFinance->remaining($fullWeekRows, $previousRows);
    }
}
