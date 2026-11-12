<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;

class CalculateEmployeeAbsenceFixedAmountRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), ['employees.absences.manage']);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW_LIST;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->months)) {
            $this->merge([
                'months' => str_replace(',', '.', $this->months),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'date_from' => ['required', 'date'],
            'months' => ['nullable', 'numeric', 'min:0.1'],
        ];
    }
}
