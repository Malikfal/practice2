<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\Payroll\Accrual\DailyPayrollAccrualService;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Console\Command;

class AccrueDailyPayrollCommand extends Command
{
    protected $signature = 'payroll:accrue-daily
        {--date= : Accrual date in YYYY-MM-DD format, defaults to yesterday}
        {--dry-run : Calculate only, without writing to finance}
        {--due : Process only companies where the local time is 00:05}';

    protected $description = 'Расчитывает и начисляет ежедневные выплаты';

    public function __construct(
        private readonly DailyPayrollAccrualService $accruals,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $summary = $this->emptySummary();
        $now = Carbon::now('UTC');

        // Команда сама обходит компании, потому что дата «вчера» зависит от их часового пояса.
        // Автоматический запуск дополнительно ограничен компаниями с включённым дневным расчётом.
        $companiesToAccrue = Company::query()
            ->where('status', 'ACTIVE')
            ->where('calculate_daily_payroll', true)
            ->with(['defaultSalaryFinanceArticle'])
            ->get()
            ->map(function (Company $company) use ($now): ?array {
                $date = $this->dateForCompany($company, $now);
                if (! $date) {
                    return null;
                }

                return ['company' => $company, 'date' => $date];
            })
            ->filter();

        foreach ($companiesToAccrue as ['company' => $company, 'date' => $date]) {
            $companySummary = $this->accruals->accrueForCompany($company, $date, $dryRun);
            $summary['date'] = $date->toDateString();
            foreach (['companies_processed', 'employees_processed', 'rows_calculated', 'finance_created', 'finance_skipped_existing'] as $metric) {
                $summary[$metric] += $companySummary[$metric];
            }
            $summary['warnings'] = [...$summary['warnings'], ...$companySummary['warnings']];
        }

        foreach ($summary['warnings'] as $warning) {
            $this->components->warn($warning);
        }

        $this->newLine();
        $this->table(
            ['Metric', 'Value'],
            [
                ['Date', $summary['date']],
                ['Companies processed', (string) $summary['companies_processed']],
                ['Employees processed', (string) $summary['employees_processed']],
                ['Rows calculated', (string) $summary['rows_calculated']],
                ['Finance created', (string) $summary['finance_created']],
                ['Finance skipped existing', (string) $summary['finance_skipped_existing']],
                ['Dry run', $dryRun ? 'yes' : 'no'],
            ],
        );

        return self::SUCCESS;
    }

    private function dateForCompany(Company $company, CarbonInterface $now): ?Carbon
    {
        $timezone = $company->payrollTimezone();
        $dateInput = $this->option('date');
        if (! $this->option('due')) {
            // Ручной запуск не использует и не изменяет состояние автоматического scheduler.
            return $dateInput
                ? Carbon::parse((string) $dateInput, $timezone)->startOfDay()
                : Carbon::instance($now)->setTimezone($timezone)->subDay()->startOfDay();
        }

        $localNow = Carbon::instance($now)->setTimezone($timezone);
        if ($localNow->format('H:i') !== '00:05') {
            return null;
        }

        return $localNow->subDay()->startOfDay();
    }

    /** @return array<string, int|string|array> */
    private function emptySummary(): array
    {
        return [
            'date' => '-',
            'companies_processed' => 0,
            'employees_processed' => 0,
            'rows_calculated' => 0,
            'finance_created' => 0,
            'finance_skipped_existing' => 0,
            'warnings' => [],
        ];
    }
}
