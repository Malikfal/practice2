<?php

namespace App\Http\Requests\Workspace;

use App\Enums\EmployeeAbsencePaymentMode;
use App\Enums\EmployeeAbsenceType;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;
use Illuminate\Validation\Rule;

class StoreEmployeeAbsenceRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), ['employees.absences.manage']);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(EmployeeAbsenceType::values())],
            'date_from' => ['required', 'date'],
            'date_to' => ['required', 'date', 'after_or_equal:date_from'],
            'payment_mode' => ['required', 'string', Rule::in(EmployeeAbsencePaymentMode::values())],
            'fixed_daily_amount' => [
                Rule::requiredIf($this->input('payment_mode') === EmployeeAbsencePaymentMode::FIXED->value),
                'nullable',
                'integer',
                'min:0',
            ],
            'coefficient' => ['nullable', 'numeric', 'min:0', 'max:999999.9999', 'decimal:0,4'],
            'comment' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
