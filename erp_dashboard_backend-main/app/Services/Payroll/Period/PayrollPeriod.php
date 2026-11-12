<?php

namespace App\Services\Payroll\Period;

use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use InvalidArgumentException;

/** Расчетный payroll-период с включающей левой и исключающей правой границей. */
final readonly class PayrollPeriod
{
    public function __construct(
        public Carbon $from,
        public Carbon $to,
    ) {
        if ($this->from->gte($this->to)) {
            throw new InvalidArgumentException('Payroll period start must be before its end.');
        }
    }

    /** Возвращает период, который закрывается в конце недели или месяца. */
    public static function endingOn(CarbonInterface $date): ?self
    {
        $end = Carbon::instance($date)->copy()->startOfDay();
        if (! $end->isSunday() && ! $end->isLastOfMonth()) {
            return null;
        }

        $weekStart = $end->copy()->startOfWeek(CarbonInterface::MONDAY);
        $monthStart = $end->copy()->startOfMonth();
        $from = $weekStart->greaterThan($monthStart) ? $weekStart : $monthStart;

        return new self(from: $from, to: $end->copy()->addDay());
    }

    /**
     * Разбивает диапазон на периоды по концу недели и месяца.
     *
     * @return Collection<int, self>
     */
    public static function between(CarbonInterface $from, CarbonInterface $to): Collection
    {
        $cursor = Carbon::instance($from)->copy()->startOfDay();
        $end = Carbon::instance($to)->copy()->startOfDay();
        $periods = collect();

        while ($cursor->lt($end)) {
            $weekBoundary = $cursor->copy()->endOfWeek(CarbonInterface::SUNDAY)->addDay()->startOfDay();
            $monthBoundary = $cursor->copy()->addMonthNoOverflow()->startOfMonth();
            $periodTo = collect([$weekBoundary, $monthBoundary, $end])
                ->sortBy(static fn (Carbon $date): int => $date->timestamp)
                ->first();

            $periods->push(new self(from: $cursor->copy(), to: $periodTo->copy()));
            $cursor = $periodTo->copy();
        }

        return $periods;
    }

    /** Возвращает дату финансовой записи периода. */
    public function paymentDate(): Carbon
    {
        return $this->to->copy()->subDay();
    }

    /** Проверяет, является ли период второй частью недели после границы месяца. */
    public function continuesSplitWeek(): bool
    {
        return $this->from->isSameDay($this->from->copy()->startOfMonth())
            && ! $this->from->isMonday();
    }

    /** Возвращает начало полной календарной недели. */
    public function weekFrom(): Carbon
    {
        return $this->from->copy()->startOfWeek(CarbonInterface::MONDAY);
    }

    /** Возвращает исключающую правую границу полной календарной недели. */
    public function weekTo(): Carbon
    {
        return $this->weekFrom()->addWeek();
    }
}
