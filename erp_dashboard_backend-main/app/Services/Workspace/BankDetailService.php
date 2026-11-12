<?php

namespace App\Services\Workspace;

use App\Enums\UserPermission;
use App\Models\BankDetail;
use App\Models\User;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class BankDetailService
{
    public function show(User $user, User $employee): ?BankDetail
    {
        $this->assertEmployeeAccess($user, $employee, allowSelfWithoutPermission: true);

        return BankDetail::query()
            ->where('employee_id', $employee->id)
            ->first();
    }

    public function store(User $user, User $employee, string $details): BankDetail
    {
        $this->assertEmployeeAccess($user, $employee);

        $bankDetail = BankDetail::query()
            ->where('employee_id', $employee->id)
            ->first();

        if ($bankDetail) {
            $bankDetail->update([
                'details' => $details,
            ]);

            return $bankDetail->refresh();
        }

        return BankDetail::create([
            'id' => (string) Str::uuid(),
            'employee_id' => $employee->id,
            'details' => $details,
        ]);
    }

    private function assertEmployeeAccess(
        User $user,
        User $employee,
        bool $allowSelfWithoutPermission = false,
    ): void
    {
        if ($allowSelfWithoutPermission && (string) $user->id === (string) $employee->id) {
            return;
        }

        $this->assertSalaryPermission($user);

        if ($user->isSuperAdmin()) {
            $this->employeeCompanyId($employee);

            return;
        }

        if ((string) $user->company_id === '' || (string) $user->company_id !== (string) $employee->company_id) {
            throw new NotFoundHttpException;
        }
    }

    private function assertSalaryPermission(User $user): void
    {
        if (! $user->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value)) {
            throw new NotFoundHttpException;
        }
    }

    private function employeeCompanyId(User $employee): string
    {
        $companyId = (string) $employee->company_id;

        if ($companyId === '') {
            throw new NotFoundHttpException;
        }

        return $companyId;
    }
}
