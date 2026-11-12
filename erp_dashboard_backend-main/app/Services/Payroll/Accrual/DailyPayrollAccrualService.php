<?php

namespace App\Services\Payroll\Accrual;

use App\Models\Company;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\PayrollFinanceRepository;
use App\Services\Payroll\Accrual\Data\DailyPayrollFinanceRow;
use App\Services\Payroll\Calculation\PayrollCalculationService;
use App\Services\Payroll\Distribution\PayrollComponentDistributionService;
use App\Services\Payroll\Finance\Data\PayrollFinanceRow;
use App\Services\Payroll\Finance\PayrollFinancePreparationService;
use App\Services\Workspace\FinanceAnalyticsServices\FinanceAnalyticsCacheService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class DailyPayrollAccrualService
{
    public function __construct(
        private readonly PayrollFinanceRepository $payrollRepository,
        private readonly PayrollCalculationService $calculations,
        private readonly PayrollComponentDistributionService $distribution,
        private readonly PayrollFinancePreparationService $financePreparation,
        private readonly FinanceAnalyticsCacheService $analyticsCache,
    ) {}

    /**
     * Начисляет зарплату одной компании за день в её локальной временной зоне.
     *
     * @return array<string, int|string|array>
     */
    public function accrueForCompany(Company $company, CarbonInterface $date, bool $dryRun = false): array
    {
        $day = Carbon::instance($date)->startOfDay();

        return [
            'date' => $day->toDateString(),
            'companies_processed' => 1,
            ...$this->processCompany($company, $day, $dryRun),
            'warnings' => [],
        ];
    }

    /**
     * Сначала считает строки по всем сотрудникам, затем синхронизирует финансы одной транзакцией.
     *
     * @return array{employees_processed:int, rows_calculated:int, finance_created:int, finance_skipped_existing:int}
     */
    private function processCompany(Company $company, Carbon $day, bool $dryRun): array
    {
        $rows = collect();
        $employeesProcessed = 0;

        User::withBlocked()
            ->where('company_id', $company->id)
            ->orderBy('id')
            ->each(function (User $employee) use ($company, $day, $rows, &$employeesProcessed): void {
                $result = $this->calculations->forDay($company, $employee, $day);
                if (! $result->hasComponents()) {
                    return;
                }

                $employeesProcessed++;

                // Дневной и итоговый перерасчет используют одну точку распределения компонентов.
                $this->financePreparation->prepare(
                    company: $company,
                    employee: $employee,
                    allocations: $this->distribution->distributeComponents(
                        components: $result->components,
                        company: $company,
                        employee: $employee,
                    ),
                )->each(function (PayrollFinanceRow $financeRow) use ($employee, $rows): void {
                    $rows->push(new DailyPayrollFinanceRow(
                        employeeId: (string) $employee->id,
                        financeArticleId: $financeRow->financeArticleId,
                        projectId: $financeRow->projectId,
                        amount: $financeRow->amount,
                    ));
                });
            });

        $dailyRows = $rows
            ->filter(static fn (DailyPayrollFinanceRow $row): bool => $row->amount > 0)
            ->values();
        $summary = [
            'employees_processed' => $employeesProcessed,
            'rows_calculated' => $dailyRows->count(),
            'finance_created' => 0,
            'finance_skipped_existing' => 0,
        ];

        if ($dryRun) {
            return $summary;
        }

        $financeSummary = DB::transaction(
            fn (): array => $this->payrollRepository->createDailyFinanceRows($company, $day, $dailyRows),
        );

        $summary['finance_created'] = $financeSummary['created'];
        $summary['finance_skipped_existing'] = $financeSummary['skipped_existing'];

        if ($summary['finance_created'] > 0) {
            $this->analyticsCache->invalidateCompany((string) $company->id);
        }

        return $summary;
    }
}
