<?php

namespace App\Services\Payroll\Distribution;

use App\Enums\PayrollHoursScope;
use App\Models\Company;
use App\Models\User;
use App\Services\Payroll\Calculation\Data\CalculatedPayrollComponent;
use App\Services\Payroll\Distribution\Data\PayrollFinanceAllocation;
use App\Services\Payroll\Distribution\Data\PayrollProjectAllocation;
use App\Services\Payroll\Hours\PayrollHoursService;
use Illuminate\Support\Collection;

class PayrollComponentDistributionService
{
    /**
     * Подключает выбор проектных весов и точное распределение суммы.
     */
    public function __construct(
        private readonly PayrollProjectDistributionService $distribution,
        private readonly PayrollHoursService $hours,
    ) {}

    /**
     * Распределяет один расчетный компонент по правилу его типа.
     *
     * @return Collection<int, PayrollFinanceAllocation>
     */
    public function distribute(
        CalculatedPayrollComponent $component,
        Company $company,
        User $employee,
    ): Collection {
        return $this->distribution->distribute(
            $component->amount,
            $this->durations($component, $company, $employee),
        );
    }

    /**
     * Распределяет компоненты и объединяет суммы одинаковых проектов.
     *
     * @param  Collection<int, CalculatedPayrollComponent>  $components
     * @return Collection<int, PayrollFinanceAllocation>
     */
    public function distributeComponents(
        Collection $components,
        Company $company,
        User $employee,
    ): Collection {
        return $components
            ->flatMap(fn (CalculatedPayrollComponent $component): Collection => $this
                ->distribute($component, $company, $employee)
                ->map(static fn (PayrollProjectAllocation $row): PayrollFinanceAllocation => new PayrollFinanceAllocation(
                    component: $component->type,
                    projectId: $row->projectId,
                    amount: $row->amount,
                )))
            ->groupBy(static fn (PayrollFinanceAllocation $row): string => implode(':', [
                $row->component->value,
                $row->projectId ?? '__none__',
            ]))
            ->map(static fn (Collection $rows): PayrollFinanceAllocation => new PayrollFinanceAllocation(
                component: $rows->first()->component,
                projectId: $rows->first()->projectId,
                amount: (int) $rows->sum('amount'),
            ))
            ->values();
    }

    /**
     * Для оклада получает часы выбранного salary_distribution_scope строго в границах
     * компонента. Для почасовых компонентов использует часы, на которых считалась сумма.
     * Если часов нет, нижележащий распределитель создает одну запись без проекта.
     *
     * @return Collection<int, object>
     */
    private function durations(
        CalculatedPayrollComponent $component,
        Company $company,
        User $employee,
    ): Collection {
        if ($component->salaryDistributionScope === null) {
            return $component->durations;
        }

        return match ($component->salaryDistributionScope) {
            PayrollHoursScope::OWN => $this->hours->own(
                $company,
                $employee,
                $component->periodFrom,
                $component->periodTo,
            ),
            PayrollHoursScope::SUPERVISED => $this->hours->supervised(
                $company,
                $employee,
                $component->periodFrom,
                $component->periodTo,
            ),
            PayrollHoursScope::COMPANY => $this->hours->company(
                $company,
                $component->periodFrom,
                $component->periodTo,
            ),
        };
    }
}
