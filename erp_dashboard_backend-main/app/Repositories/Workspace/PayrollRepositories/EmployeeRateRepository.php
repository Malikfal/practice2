<?php

namespace App\Repositories\Workspace\PayrollRepositories;

use App\Enums\EmployeeRateType;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Services\Payroll\Calculation\Data\EmployeeRatePeriod;
use App\Services\Payroll\Calculation\Rates\PayrollRateSetting;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class EmployeeRateRepository
{
    /** Возвращает последнюю ставку, которая уже действовала на указанную дату. */
    public function rateForDate(User $employee, CarbonInterface $date): ?EmployeeRate
    {
        return EmployeeRate::query()
            ->where('employee_id', $employee->id)
            ->whereDate('effective_from', '<=', $date->toDateString())
            ->orderByDesc('effective_from')
            ->orderByDesc('created_at')
            ->first();
    }

    /**
     * Действующие на дату ставки нескольких сотрудников одним запросом.
     *
     * @param  Collection<int, string>  $employeeIds
     * @return Collection<string, EmployeeRate> employee_id => ставка
     */
    public function ratesForDate(Collection $employeeIds, CarbonInterface $date): Collection
    {
        return EmployeeRate::query()
            ->whereIn('employee_id', $employeeIds->all())
            ->whereDate('effective_from', '<=', $date->toDateString())
            ->orderBy('effective_from')
            ->orderBy('created_at')
            ->get()
            // keyBy оставляет последнюю строку сотрудника, то есть самую свежую ставку, как в rateForDate().
            ->keyBy(static fn (EmployeeRate $rate): string => (string) $rate->employee_id);
    }

    /**
     * Разбивает период расчёта сотрудника по датам изменения его ставки.
     *
     * @return Collection<int, EmployeeRatePeriod>
     */
    public function ratePeriodsForPeriod(User $employee, CarbonInterface $from, CarbonInterface $to): Collection
    {
        $rates = EmployeeRate::query()
            ->where('employee_id', $employee->id)
            ->whereDate('effective_from', '<', $to->toDateString())
            ->orderBy('effective_from')
            ->orderBy('created_at')
            ->get();

        $periods = collect();
        // effective_from — календарная дата компании, а период уже построен в её часовом поясе.
        // Каст date дает полночь в поясе приложения, поэтому дату переносим в пояс периода.
        $timezone = $from->getTimezone();

        foreach ($rates as $index => /** @var EmployeeRate $rate */ $rate) {
            $nextRate = $rates->get($index + 1);
            $rateFrom = Carbon::parse($rate->effective_from->toDateString(), $timezone);
            $periodFrom = $rateFrom->greaterThan($from)
                ? $rateFrom
                : Carbon::instance($from)->copy();
            $periodTo = $nextRate
                ? Carbon::parse($nextRate->effective_from->toDateString(), $timezone)
                : Carbon::instance($to)->copy();

            if ($periodTo->lte($from) || $periodFrom->gte($to) || $periodFrom->gte($periodTo)) {
                continue;
            }

            $periods->push(new EmployeeRatePeriod(
                rate: $rate,
                from: $periodFrom->lessThan($from) ? Carbon::instance($from)->copy() : $periodFrom,
                to: $periodTo->greaterThan($to) ? Carbon::instance($to)->copy() : $periodTo,
            ));
        }

        return $periods->values();
    }

    /** Находит настройку нужного типа в JSON-снимке конкретной ставки. */
    public function settingForDate(EmployeeRate $rate, EmployeeRateType $type): ?PayrollRateSetting
    {
        return collect($rate->rate_settings ?? [])
            ->filter(static fn (mixed $setting): bool => is_array($setting))
            ->map(static fn (array $setting): ?PayrollRateSetting => PayrollRateSetting::fromArray($setting))
            ->filter()
            ->first(static fn (PayrollRateSetting $setting): bool => $setting->rateType === $type);
    }

    /**
     * Возвращает сотрудников, чьи часы не входят в компанию и подконтрольные часы на эту дату.
     *
     * @return Collection<int, string>
     */
    public function excludedWorkerIds(Company $company, CarbonInterface $date): Collection
    {
        return EmployeeRate::query()
            // DISTINCT ON оставляет по одной самой свежей ставке каждого сотрудника.
            ->whereIn('id', function ($query) use ($date): void {
                $query
                    ->selectRaw('DISTINCT ON (employee_id) id')
                    ->from('employee_rates')
                    ->whereDate('effective_from', '<=', $date->toDateString())
                    ->orderBy('employee_id')
                    ->orderByDesc('effective_from')
                    ->orderByDesc('created_at');
            })
            ->where('exclude_from_supervised_hours', true)
            ->whereHas('employee', static fn ($query) => $query->where('company_id', $company->id))
            ->pluck('employee_id')
            ->map(static fn ($id): string => (string) $id)
            ->values();
    }
}
