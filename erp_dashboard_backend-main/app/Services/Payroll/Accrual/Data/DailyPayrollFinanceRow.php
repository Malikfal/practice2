<?php

namespace App\Services\Payroll\Accrual\Data;

/** Подготовленная строка предварительного ежедневного начисления сотрудника. */
final readonly class DailyPayrollFinanceRow
{
    public function __construct(
        public string $employeeId,
        public ?string $financeArticleId,
        public ?string $projectId,
        public int $amount,
    ) {}
}
