<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;
use App\Support\Pagination;
use Illuminate\Validation\Rule;

class EmployeePayrollCalculationRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $employee = $this->route('employee');
        $user = $this->user();

        if ($employee && $user && (string) $employee->id === (string) $user->id) {
            return true;
        }

        return PermissionAccess::canAny($user, ['employees.tabs.salary.view']);
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
        return [
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', Rule::in(Pagination::PER_PAGE_OPTIONS)],
        ];
    }
}
