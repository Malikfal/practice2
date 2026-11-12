<?php

namespace App\Services\Workspace\FinanceAnalyticsServices\Distribution\Data;

use App\Models\Finance;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Неизменяемый период с включёнными границами для распределения финансовой операции.
 */
final readonly class DistributionPeriodData
{
    public function __construct(
        public Carbon $from,
        public Carbon $to,
    ) {}

    /**
     * Создаёт нормализованный период; перепутанные границы меняются местами.
     */
    public static function fromFinance(Finance $finance, ?string $timezone = null): self
    {
        $from = self::localDate($finance->distribution_from ?? $finance->dateOfPayment, $timezone);
        $to = self::localDate($finance->distribution_to ?? $finance->dateOfPayment, $timezone);

        return $to->lt($from) ? new self($to, $from) : new self($from, $to);
    }

    private static function localDate(string|CarbonInterface $value, ?string $timezone): Carbon
    {
        $date = $value instanceof CarbonInterface ? $value->toDateString() : $value;

        return Carbon::parse($date, $timezone)->startOfDay();
    }

    /**
     * Определяет, относится ли операция ровно к одному календарному дню.
     */
    public function isSingleDay(): bool
    {
        return $this->from->isSameDay($this->to);
    }
}
