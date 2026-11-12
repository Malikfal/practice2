<?php

namespace App\Services\Payroll\Calculation\Rates\Data;

use App\Enums\PayrollProjectHoursType;

/** Часть оплаты обычных часов по одной ставке: диапазону расширенной формулы или базовой ставке. */
final readonly class PayrollRateLine
{
    /**
     * @param  ?float  $fromHours  Начало диапазона; null для базовой ставки без диапазонов.
     * @param  ?float  $toHours  Конец диапазона; null для открытого диапазона или базовой ставки.
     */
    public function __construct(
        public PayrollProjectHoursType $projectHoursType,
        public ?float $fromHours,
        public ?float $toHours,
        public int $rate,
        public int $seconds,
        public int $amount,
    ) {}
}
