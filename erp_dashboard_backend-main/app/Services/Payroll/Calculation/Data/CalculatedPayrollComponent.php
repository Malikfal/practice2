<?php

namespace App\Services\Payroll\Calculation\Data;

use App\Enums\PayrollComponentType;
use App\Enums\PayrollHoursScope;
use App\Models\EmployeeAbsence;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/** Рассчитанная сумма одного типа ставки или фиксированного отсутствия за период. */
final readonly class CalculatedPayrollComponent
{
    /** @param Collection<int, object> $durations Проектные часы, на которых основан компонент. */
    public function __construct(
        public PayrollComponentType $type,
        public int $amount,
        public CarbonInterface $periodFrom,
        public CarbonInterface $periodTo,
        public Collection $durations,
        public ?EmployeeAbsence $absence = null,
        public ?PayrollHoursScope $salaryDistributionScope = null,
    ) {}
}
