<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PayrollPayoutKind;
use Illuminate\Validation\Rule;

class UpdatePayrollPayoutPlanRequest extends PayrollPayoutManageRequest
{
    public function rules(): array
    {
        return [
            'employee_id' => ['bail', 'required', 'uuid', $this->employeeExists()],
            'month' => ['required', 'string', PayrollPayoutViewRequest::MONTH_FORMAT],
            'kind' => ['required', Rule::enum(PayrollPayoutKind::class)],
            // null возвращает расчетную сумму.
            'amount' => ['present', 'nullable', 'integer', 'min:0'],
        ];
    }
}
