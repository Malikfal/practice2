<?php

namespace App\Services\Payroll\Calculation\Rates\Types;

use App\Enums\EmployeeRateType;
use App\Enums\PayrollHoursScope;
use App\Models\Company;
use App\Models\EmployeeRate;
use App\Models\User;
use App\Repositories\Workspace\PayrollRepositories\EmployeeRateRepository;
use App\Services\Payroll\Calculation\Rates\PayrollRateSetting;
use App\Services\Payroll\Hours\PayrollHoursService;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

abstract class EmployeeRatePayrollService
{
    public function __construct(
        protected readonly EmployeeRateRepository $rates,
        protected readonly PayrollHoursService $payrollHours,
    ) {}

    abstract public function type(): EmployeeRateType;

    /**
     * Возвращает базовую ставку из колонок employee_rates для этого типа оплаты.
     */
    abstract public function baseRate(EmployeeRate $rate): ?int;

    /**
     * Определяет набор часов, который используется, если расширенная настройка не указала scope.
     */
    abstract public function defaultScope(): PayrollHoursScope;

    /**
     * Возвращает часы, которые используются для конкретного типа ставки.
     */
    abstract public function durations(
        Company $company,
        User $employee,
        CarbonInterface $from,
        CarbonInterface $to,
        ?PayrollRateSetting $setting,
    ): Collection;

    /**
     * Возвращает расширенную настройку этого типа внутри выбранного среза EmployeeRate.
     */
    public function settingForDate(EmployeeRate $rate): ?PayrollRateSetting
    {
        return $this->rates->settingForDate($rate, $this->type());
    }

    /**
     * Берет scope из расширенной настройки или возвращает дефолт для типа оплаты.
     */
    public function scopeFromSetting(?PayrollRateSetting $setting): PayrollHoursScope
    {
        return $setting?->hoursScope ?? $this->defaultScope();
    }

    /**
     * Дефолт из rate_settings используется только для расширенной формулы.
     * Если is_advanced=false, ставка берется из employee_rates.
     */
    public function defaultRate(EmployeeRate $rate, ?PayrollRateSetting $setting): int
    {
        $value = $setting?->isAdvanced && $setting->defaultRate !== null
            ? $setting->defaultRate
            : $this->baseRate($rate);

        return (int) ($value ?? 0);
    }
}
