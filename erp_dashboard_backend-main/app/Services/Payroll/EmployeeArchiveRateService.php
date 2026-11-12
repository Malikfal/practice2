<?php

namespace App\Services\Payroll;

use App\Enums\PayrollHoursScope;
use App\Models\EmployeeRate;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class EmployeeArchiveRateService
{
    /**
     * Создает или обновляет ставку на сегодня: пассивные ставки отключены (null),
     * ставка за собственные часы остается прежней.
     */
    public function archive(User $employee, ?User $changedBy = null, ?CarbonInterface $archivedOn = null): EmployeeRate
    {
        return DB::transaction(function () use ($employee, $changedBy, $archivedOn): EmployeeRate {
            $company = $employee->company ?? $employee->company()->firstOrFail();
            $effectiveFrom = $archivedOn?->copy()->startOfDay()
                ?? now($company->payrollTimezone())->startOfDay();
            /** @var EmployeeRate|null $currentRate */
            $currentRate = EmployeeRate::query()
                ->where('employee_id', $employee->id)
                ->whereDate('effective_from', '<=', $effectiveFrom->toDateString())
                ->orderByDesc('effective_from')
                ->orderByDesc('created_at')
                ->lockForUpdate()
                ->first();
            $attributes = [
                'salary' => null,
                'salary_distribution_scope' => $currentRate?->salary_distribution_scope?->value
                    ?? PayrollHoursScope::COMPANY->value,
                'hourly_rate' => $currentRate?->hourly_rate,
                'supervised_hourly_rate' => null,
                'company_hourly_rate' => null,
                'exclude_from_supervised_hours' => (bool) ($currentRate?->exclude_from_supervised_hours ?? false),
                'rate_settings' => null,
                'changed_by' => $changedBy?->id ?? $employee->id,
            ];

            if ($currentRate?->effective_from->isSameDay($effectiveFrom)) {
                $currentRate->update($attributes);

                return $currentRate->refresh();
            }

            return EmployeeRate::query()->create([
                'id' => (string) Str::uuid(),
                'employee_id' => $employee->id,
                ...$attributes,
                'effective_from' => $effectiveFrom->toDateString(),
            ]);
        });
    }
}
