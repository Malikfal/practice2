<?php

namespace App\Services\Payroll\Payouts\Data;

/** Строка ведомости сотрудника за месяц. Все суммы в копейках. */
final readonly class PayrollPayoutMonth
{
    public function __construct(
        public string $month,
        public int $carryIn,
        public int $accrued,
        public int $firstHalf,
        public PayrollPayoutCell $advance,
        public PayrollPayoutCell $settlement,
        public int $totalDue,
        public int $carryOut,
        public int $debtIn,
        public int $debtOut,
    ) {}

    public function paid(): int
    {
        return $this->advance->paid + $this->settlement->paid;
    }

    /** Остаток считается по строке целиком: переплата одной выплаты закрывает недоплату другой. */
    public function unpaid(): int
    {
        return max(0, $this->totalDue - $this->paid());
    }

    public function isFullyPaid(): bool
    {
        return $this->paid() > 0 && $this->paid() >= $this->totalDue;
    }
}
