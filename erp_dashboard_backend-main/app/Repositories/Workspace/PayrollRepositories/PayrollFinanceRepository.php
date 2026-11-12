<?php

namespace App\Repositories\Workspace\PayrollRepositories;

use App\Enums\FinanceArticleDistributionMethod;
use App\Enums\FinanceSource;
use App\Enums\FinanceType;
use App\Models\Company;
use App\Models\Finance;
use App\Models\User;
use App\Services\Payroll\Accrual\Data\DailyPayrollFinanceRow;
use App\Services\Payroll\Finance\Data\PayrollFinanceRow;
use App\Services\Payroll\Period\PayrollPeriod;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PayrollFinanceRepository
{
    /**
     * Создаёт ежедневные начисления и пропускает уже существующие строки сотрудника/проекта.
     *
     * @param  Collection<int, DailyPayrollFinanceRow>  $rows
     * @return array{created:int, skipped_existing:int}
     */
    public function createDailyFinanceRows(Company $company, CarbonInterface $day, Collection $rows): array
    {
        $existingKeys = Finance::query()
            ->where('company_id', $company->id)
            ->whereDate('dateOfPayment', $day->toDateString())
            ->where('type', FinanceType::EXPENDITURE->value)
            ->where('source', FinanceSource::PAYROLL_DAILY->value)
            ->get()
            ->mapWithKeys(static fn (Finance $finance): array => [
                (string) $finance->employee_id.':'.($finance->project_id ?: '__none__') => true,
            ]);

        $summary = ['created' => 0, 'skipped_existing' => 0];

        /**
         * @var DailyPayrollFinanceRow $row
         */
        foreach ($rows as $row) {
            $key = $row->employeeId.':'.($row->projectId ?? '__none__');
            if ($existingKeys->has($key)) {
                $summary['skipped_existing']++;

                continue;
            }

            Finance::query()->create([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'project_id' => $row->projectId,
                'finance_article_id' => $row->financeArticleId,
                'employee_id' => $row->employeeId,
                'amount' => $row->amount,
                'type' => FinanceType::EXPENDITURE->value,
                'source' => FinanceSource::PAYROLL_DAILY->value,
                'comment' => sprintf('Daily payroll %s amount=%d', $day->toDateString(), $row->amount),
                'dateOfPayment' => $day->toDateString(),
                'distribution_from' => $day->toDateString(),
                'distribution_to' => $day->toDateString(),
                'distribution_method' => FinanceArticleDistributionMethod::BY_TERM->value,
            ]);
            $summary['created']++;
        }

        return $summary;
    }

    /**
     * Создаёт итоговые строки перерасчёта зарплаты, пропуская нулевые суммы.
     *
     * @param  Collection<int, PayrollFinanceRow>  $rows
     */
    public function createPayrollFinanceRows(
        Company $company,
        User $employee,
        PayrollPeriod $period,
        Collection $rows,
    ): int {
        $written = 0;

        foreach ($rows as $row) {
            if ($row->amount <= 0) {
                continue;
            }

            Finance::query()->create([
                'id' => (string) Str::uuid(),
                'company_id' => $company->id,
                'project_id' => $row->projectId,
                'finance_article_id' => $row->financeArticleId,
                'employee_id' => $employee->id,
                'amount' => $row->amount,
                'type' => FinanceType::EXPENDITURE->value,
                'source' => FinanceSource::PAYROLL_RECALCULATION->value,
                'comment' => sprintf(
                    'Payroll recalculation %s-%s',
                    $period->from->toDateString(),
                    $period->paymentDate()->toDateString(),
                ),
                'dateOfPayment' => $period->paymentDate()->toDateString(),
                'distribution_from' => $period->from->toDateString(),
                'distribution_to' => $period->paymentDate()->toDateString(),
                'distribution_method' => FinanceArticleDistributionMethod::BY_TERM->value,
            ]);
            $written++;
        }

        return $written;
    }

    /**
     * Собирает начисления периода в итоговые суммы по статье и проекту.
     *
     * @param  Collection<int, FinanceSource>  $sources
     * @return Collection<int, PayrollFinanceRow>
     */
    public function payrollFinanceRowsForPeriod(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        Collection $sources,
    ): Collection {
        return Finance::query()
            ->where('company_id', $company->id)
            ->where('employee_id', $employee->id)
            ->where('type', FinanceType::EXPENDITURE->value)
            ->whereIn('source', $sources->map(static fn (FinanceSource $source): string => $source->value)->all())
            ->whereDate('dateOfPayment', '>=', $from->toDateString())
            ->whereDate('dateOfPayment', '<', $to->toDateString())
            ->selectRaw('finance_article_id, project_id, SUM(amount) as amount')
            ->groupBy('finance_article_id', 'project_id')
            ->get()
            ->map(static fn (Finance $finance): PayrollFinanceRow => new PayrollFinanceRow(
                financeArticleId: $finance->finance_article_id ? (string) $finance->finance_article_id : null,
                projectId: $finance->project_id ? (string) $finance->project_id : null,
                amount: (int) $finance->amount,
            ))
            ->values();
    }

    /**
     * Удаляет прежние начисления компании перед повторным расчётом периода.
     *
     * @param  Collection<int, FinanceSource>  $sources
     */
    public function deleteCompanyPayrollFinancesForPeriod(
        Company $company,
        PayrollPeriod $period,
        Collection $sources,
    ): int {
        return Finance::query()
            ->where('company_id', $company->id)
            ->whereIn('source', $sources->map(static fn (FinanceSource $source): string => $source->value)->all())
            ->whereDate('dateOfPayment', '>=', $period->from->toDateString())
            ->whereDate('dateOfPayment', '<', $period->to->toDateString())
            ->delete();
    }
}
