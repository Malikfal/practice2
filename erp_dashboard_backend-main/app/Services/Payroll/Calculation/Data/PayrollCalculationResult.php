<?php

namespace App\Services\Payroll\Calculation\Data;

use Illuminate\Support\Collection;

/** Полный результат расчета оплаты сотрудника, состоящий из отдельных компонентов. */
final readonly class PayrollCalculationResult
{
    /** @param Collection<int, CalculatedPayrollComponent> $components */
    public function __construct(public Collection $components) {}

    /** Возвращает полную сумму всех расчетных компонентов. */
    public function totalAmount(): int
    {
        return (int) $this->components->sum(
            static fn (CalculatedPayrollComponent $component): int => $component->amount,
        );
    }

    /** Проверяет наличие хотя бы одного положительного начисления. */
    public function hasComponents(): bool
    {
        return $this->components->contains(
            static fn (CalculatedPayrollComponent $component): bool => $component->amount > 0,
        );
    }
}
