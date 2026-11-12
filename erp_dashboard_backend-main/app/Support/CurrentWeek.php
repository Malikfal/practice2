<?php

namespace App\Support;

use App\Models\Company;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class CurrentWeek
{
    /**
     * Границы текущей недели (с понедельника 00:00) в часовом поясе компании.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function bounds(string $companyId, ?CarbonInterface $now = null): array
    {
        $timezone = Company::query()->find($companyId)?->payrollTimezone()
            ?? (string) (config('payroll.timezone') ?: 'Europe/Moscow');
        $reference = $now
            ? Carbon::instance($now)->copy()->setTimezone($timezone)
            : now($timezone);

        $from = $reference->startOfWeek(CarbonInterface::MONDAY);

        return [$from, $from->copy()->addWeek()];
    }
}
