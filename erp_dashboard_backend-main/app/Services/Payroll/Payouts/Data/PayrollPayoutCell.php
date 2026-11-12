<?php

namespace App\Services\Payroll\Payouts\Data;

/** Аванс или расчет сотрудника за месяц: сумма к выплате и ее состояние. */
final readonly class PayrollPayoutCell
{
    public const STATUS_ZERO = 'zero';

    public const STATUS_NONE = 'none';

    public const STATUS_PART = 'part';

    public const STATUS_FULL = 'full';

    public const STATUS_OVER = 'over';

    public function __construct(
        public int $due,
        public int $auto,
        public int $paid,
        public bool $isFixed,
        public bool $isManual,
    ) {}

    public function rest(): int
    {
        return max(0, $this->due - $this->paid);
    }

    public function over(): int
    {
        return max(0, $this->paid - $this->due);
    }

    public function status(): string
    {
        if ($this->paid === 0) {
            return $this->due > 0 ? self::STATUS_NONE : self::STATUS_ZERO;
        }

        return match ($this->paid <=> $this->due) {
            -1 => self::STATUS_PART,
            0 => self::STATUS_FULL,
            default => self::STATUS_OVER,
        };
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'amount' => $this->due,
            'auto_amount' => $this->auto,
            'paid' => $this->paid,
            'rest' => $this->rest(),
            'over' => $this->over(),
            'status' => $this->status(),
            'is_fixed' => $this->isFixed,
            'is_manual' => $this->isManual,
        ];
    }
}
