<?php

namespace App\Console\Commands;

use App\Models\UserNotification;
use Illuminate\Console\Command;

class PruneUserNotificationsCommand extends Command
{
    protected $signature = 'notifications:prune
        {--read-days=90 : Удалять прочитанные уведомления старше этого числа дней}
        {--days=180 : Удалять любые уведомления старше этого числа дней}';

    protected $description = 'Удаляет старые уведомления из лент пользователей';

    public function handle(): int
    {
        $readDeleted = UserNotification::query()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays((int) $this->option('read-days')))
            ->delete();
        $oldDeleted = UserNotification::query()
            ->where('created_at', '<', now()->subDays((int) $this->option('days')))
            ->delete();

        $this->info("Удалено прочитанных: {$readDeleted}, устаревших: {$oldDeleted}.");

        return self::SUCCESS;
    }
}
