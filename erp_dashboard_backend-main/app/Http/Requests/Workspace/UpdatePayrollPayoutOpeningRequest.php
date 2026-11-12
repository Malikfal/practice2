<?php

namespace App\Http\Requests\Workspace;

class UpdatePayrollPayoutOpeningRequest extends PayrollPayoutManageRequest
{
    public function rules(): array
    {
        return [
            'employee_id' => ['bail', 'required', 'uuid', $this->employeeExists()],
            // Минус означает переплату сотруднику на начало учета.
            'amount' => ['required', 'integer'],
        ];
    }
}
