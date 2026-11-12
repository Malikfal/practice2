<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\Workspace\Reports\ManagerReport\ManagerReportStatsCollector;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CollectManagerReportStatsCommand extends Command
{
    protected $signature = 'reports:collect-manager-stats
        {--from= : First date in YYYY-MM-DD, defaults to 14 days ago in the company timezone}
        {--to= : Last date in YYYY-MM-DD, defaults to today in the company timezone}
        {--all : Collect from the first PM assignment of each company}
        {--company= : Only this company ID}';

    protected $description = 'Собирает статистику отчета по менеджерам за расчетные периоды';

    /** Глубина автоматического пересбора: правки времени и начислений за прошлую неделю тоже попадают в отчет. */
    private const RECENT_DAYS = 14;

    public function __construct(private readonly ManagerReportStatsCollector $collector)
    {
        parent::__construct();
    }

    public function handle(): int
    {
        $companies = Company::query()
            ->where('status', 'ACTIVE')
            ->when($this->option('company'), fn ($query, $id) => $query->whereKey($id))
            ->get();
        $periods = 0;

        foreach ($companies as $company) {
            $today = Carbon::now($company->payrollTimezone())->startOfDay();
            $from = $this->option('from') ?: ($this->option('all')
                ? $this->firstAssignmentDate($company)
                : $today->copy()->subDays(self::RECENT_DAYS)->toDateString());
            $to = $this->option('to') ?: $today->toDateString();

            if (! $from || $from > $to) {
                continue;
            }

            $count = $this->collector->collectRange($company, $from, $to);
            $periods += $count;
            $this->line(sprintf('%s: %s - %s, periods: %d', $company->id, $from, $to, $count));
        }

        $this->components->info(sprintf('Companies: %d, periods: %d', $companies->count(), $periods));

        return self::SUCCESS;
    }

    private function firstAssignmentDate(Company $company): ?string
    {
        $date = DB::table('project_assignment_histories as assignment')
            ->join('projects as p', 'p.id', '=', 'assignment.project_id')
            ->where('p.company_id', $company->id)
            ->where('assignment.is_pm', true)
            ->min('assignment.started_on');

        return $date ? substr((string) $date, 0, 10) : null;
    }
}
