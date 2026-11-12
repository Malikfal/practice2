<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\Payroll\Period\PayrollPeriod;
use App\Services\Payroll\Recalculation\CompanyPayrollRecalculationService;
use Carbon\Carbon;
use Illuminate\Console\Command;

class RecalculatePayrollPeriodCommand extends Command
{
    protected $signature = 'payroll:recalculate-period
        {--date= : Closing date in YYYY-MM-DD format, defaults to yesterday}
        {--due : Process only companies where the local time is 00:30}';

    protected $description = 'Пересчитывает закрывшийся вчера период (конец недели или конец месяца) для всех активных компаний';

    public function __construct(
        private readonly CompanyPayrollRecalculationService $recalculations,
    ) {
        parent::__construct();
    }

    /**
     * Пересчитывает закрывшийся вчера период для всех активных компаний.
     */
    public function handle(): int
    {
        $companies = 0;
        $employees = 0;
        $created = 0;
        $periodFrom = null;
        $periodTo = null;
        $now = Carbon::now('UTC');

        // У каждой компании собственные локальные сутки, поэтому дата закрывшегося
        // периода определяется внутри обхода, а не один раз для всей команды.
        $companiesToRecalculate = Company::query()
            ->where('status', 'ACTIVE')
            ->get()
            ->map(function (Company $company) use ($now): ?array {
                $timezone = $company->payrollTimezone();
                $localNow = $now->copy()->setTimezone($timezone);

                // В автоматическом режиме компания обрабатывается ровно в локальные 00:30.
                if ($this->option('due') && $localNow->format('H:i') !== '00:30') {
                    return null;
                }

                $date = $this->option('date')
                    ? Carbon::parse((string) $this->option('date'), $timezone)->startOfDay()
                    : $localNow->subDay()->startOfDay();
                $period = PayrollPeriod::endingOn($date);
                if (! $period) {
                    return null;
                }

                return ['company' => $company, 'period' => $period];
            })
            ->filter();

        foreach ($companiesToRecalculate as ['company' => $company, 'period' => $period]) {
            // Перерасчёт выполняется только для дня, закрывающего неделю или месяц.
            $result = $this->recalculations->recalculate($company, $period);
            $companies++;
            $employees += $result->employeesProcessed;
            $created += $result->created;
            $periodFrom ??= $period->from->toDateString();
            $periodTo ??= $period->paymentDate()->toDateString();
        }

        $this->table(['Metric', 'Value'], [
            ['Period from', $periodFrom ?? '-'],
            ['Period to', $periodTo ?? '-'],
            ['Companies processed', (string) $companies],
            ['Employees processed', (string) $employees],
            ['Finance rows created', (string) $created],
        ]);

        return self::SUCCESS;
    }
}
