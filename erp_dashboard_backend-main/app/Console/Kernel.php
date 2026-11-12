<?php

namespace App\Console;

use App\Models\Company;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;
use Throwable;

class Kernel extends ConsoleKernel
{
    protected function schedule(Schedule $schedule): void
    {
        // Daily cleanup for activity log entries older than the configured retention period.
        $schedule->command('activitylog:clean --force')->daily();
        $schedule->command('notifications:prune')->dailyAt('03:30');

        $schedule->command('payroll:accrue-daily --due')->everyFiveMinutes();
        $schedule->command('payroll:recalculate-period --due')->everyTenMinutes();
        // Статистика отчета по менеджерам за последние две недели, старые периоды уже накоплены.
        $schedule->command('reports:collect-manager-stats')->hourlyAt(15)->withoutOverlapping();

        if (config('services.flow_stats.enabled')) {
            // APP_TIMEZONE по умолчанию UTC, поэтому время рассылки задаём в поясе компании.
            $timezone = $this->flowStatsTimezone();
            // Топ-3 стоит раньше дневной статистики: в понедельник в 9:10 он должен прийти первым.
            $schedule->command('reports:send-flow-stats --report=top')
                ->cron('10 9 * * 1')->timezone($timezone)->withoutOverlapping(30);
            $schedule->command('reports:send-flow-stats --report=daily')
                ->cron('10 9,13,17 * * *')->timezone($timezone)->withoutOverlapping(30);
            $schedule->command('reports:send-flow-stats --report=weekly')
                ->cron('59 20 * * 0')->timezone($timezone)->withoutOverlapping(30);
        }
    }

    /**
     * Пояс компании из рассылки статистики Flow. Если база недоступна, schedule:run не должен падать.
     */
    private function flowStatsTimezone(): string
    {
        try {
            $company = Company::query()->find((string) config('services.flow_stats.company_id'));

            return $company?->payrollTimezone() ?? (string) (config('payroll.timezone') ?: 'Europe/Moscow');
        } catch (Throwable) {
            return 'Europe/Moscow';
        }
    }

    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
