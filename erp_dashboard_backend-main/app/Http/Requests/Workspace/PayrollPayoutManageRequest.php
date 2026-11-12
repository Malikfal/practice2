<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/** Проводить выплаты и менять суммы может тот, кто видит зарплаты и управляет финансами. */
class PayrollPayoutManageRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAll($this->user(), [
            UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value,
            UserPermission::FINANCE_MANAGE->value,
        ]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::FINANCE;
    }

    public function rules(): array
    {
        return [];
    }

    protected function employeeExists(): Exists
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));
    }
}
