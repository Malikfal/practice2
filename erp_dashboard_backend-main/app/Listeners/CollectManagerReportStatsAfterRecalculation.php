<?php

namespace App\Listeners;

use App\Events\PayrollPeriodRecalculated;
use App\Services\Workspace\Reports\ManagerReport\ManagerReportStatsCollector;
use Throwable;

/** Перерасчет меняет начисления, на которых построены стоимости часа в отчете по менеджерам. */
class CollectManagerReportStatsAfterRecalculation
{
    public function __construct(private readonly ManagerReportStatsCollector $collector) {}

    public function handle(PayrollPeriodRecalculated $event): void
    {
        // Ошибка статистики не должна отменять уже сохраненный перерасчет; период пересоберет команда.
        try {
            $this->collector->collectRange(
                $event->company,
                $event->period->from->toDateString(),
                $event->period->paymentDate()->toDateString(),
            );
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
