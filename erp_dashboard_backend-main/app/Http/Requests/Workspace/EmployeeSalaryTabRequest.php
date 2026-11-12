<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;

class EmployeeSalaryTabRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $employee = $this->route('employee');
        $user = $this->user();

        if ($employee && $user && (string) $employee->id === (string) $user->id) {
            return true;
        }

        return PermissionAccess::canAny($this->user(), ['employees.tabs.salary.view']);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW_LIST;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [];
    }
}
