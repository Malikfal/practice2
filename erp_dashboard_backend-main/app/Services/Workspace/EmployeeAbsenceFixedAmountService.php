<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\User;
use App\Repositories\Workspace\EmployeeAbsenceRepository;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class EmployeeAbsenceFixedAmountService
{
    public function __construct(
        private readonly EmployeeAbsenceRepository $absences,
    ) {}

    /**
     * @param  array{date_from:string, months?:int|float|string}  $data
     * @return array<string, float|int|string>
     */
    public function calculate(User $user, User $employee, array $data): array
    {
        $this->assertEmployeeAccess($user, $employee);

        $months = (float) ($data['months'] ?? 6);
        $dateFrom = Carbon::parse($data['date_from'])->startOfDay();
        $calculationTo = $dateFrom->copy()->subDay()->startOfDay();
        $calculationFrom = $this->subtractMonths($dateFrom, $months);
        $days = $this->daysCount($calculationFrom, $calculationTo);

        $payrollAmount = $this->absences->payrollAmountForFixedAmountCalculation(
            $employee,
            $calculationFrom,
            $calculationTo,
        );

        return [
            'months' => $months,
            'calculation_from' => $calculationFrom->toDateString(),
            'calculation_to' => $calculationTo->toDateString(),
            'payroll_amount_kopecks' => $payrollAmount,
            'days' => $days,
            'working_days' => $days,
            'fixed_daily_amount' => $days > 0 ? (int) floor($payrollAmount / $days) : 0,
        ];
    }

    private function assertEmployeeAccess(User $user, User $employee): void
    {
        if ($user->isSuperAdmin()) {
            $this->employeeCompanyId($employee);

            return;
        }

        if (! $user->can(UserPermission::EMPLOYEES_ABSENCES_MANAGE->value)) {
            throw new NotFoundHttpException();
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $employee->company_id) {
            throw new NotFoundHttpException();
        }
    }

    private function employeeCompanyId(User $employee): string
    {
        $companyId = (string) $employee->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException();
        }

        return $companyId;
    }

    private function subtractMonths(CarbonInterface $date, float $months): Carbon
    {
        $fullMonths = (int) floor($months);
        $fractionDays = (int) round(($months - $fullMonths) * 30);

        return Carbon::instance($date)
            ->copy()
            ->subMonthsNoOverflow($fullMonths)
            ->subDays($fractionDays)
            ->startOfDay();
    }

    private function daysCount(CarbonInterface $from, CarbonInterface $to): int
    {
        if ($to->lt($from)) {
            return 0;
        }

        return (int) $from->diffInDays($to) + 1;
    }
}
