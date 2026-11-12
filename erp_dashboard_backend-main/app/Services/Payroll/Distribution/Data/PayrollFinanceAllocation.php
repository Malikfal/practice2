<?php

namespace App\Services\Payroll\Distribution\Data;

use App\Enums\PayrollComponentType;

/** Итоговая сумма расчетного компонента, подготовленная для записи в финансы. */
final readonly class PayrollFinanceAllocation
{
    public function __construct(
        public PayrollComponentType $component,
        public ?string $projectId,
        public int $amount,
    ) {}
}
