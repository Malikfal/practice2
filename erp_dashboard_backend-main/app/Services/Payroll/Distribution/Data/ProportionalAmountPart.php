<?php

namespace App\Services\Payroll\Distribution\Data;

/** Промежуточная доля суммы для точного пропорционального распределения остатка. */
final readonly class ProportionalAmountPart
{
    public function __construct(
        public int $index,
        public ?string $projectId,
        public int $amount,
        public float $fraction,
    ) {}

    /**
     * Возвращает ту же долю с измененной целой суммой.
     * В основном нужно чтобы остатки раскидать.
     */
    public function withAmount(int $amount): self
    {
        return new self(
            index: $this->index,
            projectId: $this->projectId,
            amount: $amount,
            fraction: $this->fraction,
        );
    }
}
