<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Services\Workspace\Reports\FlowStats\FlowStatsCalculator;
use App\Services\Workspace\Reports\FlowStats\FlowStatsFormatter;
use App\Services\Workspace\Reports\FlowStats\FlowStatsTelegramSender;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Throwable;

class SendFlowStatsCommand extends Command
{
    protected $signature = 'reports:send-flow-stats
        {--report=daily : daily, weekly or top}
        {--at= : Report moment "YYYY-MM-DD HH:MM" in the company timezone, defaults to now}
        {--company= : Company ID, defaults to services.flow_stats.company_id}
        {--dry-run : Print the messages and send nothing}';

    protected $description = 'Отправляет статистику часов Flow в Telegram: за день, за неделю или топ проектов';

    private const REPORTS = ['daily', 'weekly', 'top'];

    public function __construct(
        private readonly FlowStatsCalculator $calculator,
        private readonly FlowStatsFormatter $formatter,
        private readonly FlowStatsTelegramSender $sender,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $report = (string) $this->option('report');
        if (! in_array($report, self::REPORTS, true)) {
            $this->components->error('Unknown report: '.$report.'. Use daily, weekly or top.');

            return self::INVALID;
        }

        $companyId = (string) ($this->option('company') ?: config('services.flow_stats.company_id'));
        $company = $companyId !== '' ? Company::query()->find($companyId) : null;
        if ($company === null) {
            $this->components->error('Company not found. Set FLOW_STATS_COMPANY_ID or pass --company.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        if (! $dryRun && ! $this->sender->isConfigured()) {
            $this->components->error('Telegram is not configured: set FLOW_STATS_BOT_TOKEN and FLOW_STATS_CHAT_IDS.');

            return self::FAILURE;
        }

        try {
            $at = $this->option('at')
                ? CarbonImmutable::parse((string) $this->option('at'), $company->payrollTimezone())
                : CarbonImmutable::now($company->payrollTimezone());
        } catch (Throwable) {
            $this->components->error('Invalid --at value.');

            return self::INVALID;
        }

        $messages = match ($report) {
            'daily' => $this->formatter->daily($this->calculator->daily($company, $at)),
            'weekly' => $this->formatter->weekly($this->calculator->weekly($company, $at)),
            'top' => $this->formatter->top($this->calculator->top($company, $at)),
        };

        if ($dryRun) {
            $this->line(sprintf('%s, %s, %s', $report, $at->format('Y-m-d H:i T'), $company->id));
            foreach ($messages as $index => $message) {
                $this->newLine();
                $this->line(sprintf('--- %d/%d, %d chars ---', $index + 1, count($messages), mb_strlen($message)));
                $this->line($message);
            }

            return self::SUCCESS;
        }

        if (! $this->sender->send($messages)) {
            $this->components->error('Some messages were not sent, see the log.');

            return self::FAILURE;
        }

        $this->components->info(sprintf('Sent %d messages to %d chats.', count($messages), count($this->sender->chatIds())));

        return self::SUCCESS;
    }
}
