<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PayrollPayoutKind;
use Illuminate\Validation\Rule;

class StorePayrollPayoutRequest extends PayrollPayoutManageRequest
{
    public function rules(): array
    {
        return [
            'month' => ['required', 'string', PayrollPayoutViewRequest::MONTH_FORMAT],
            'kind' => ['required', Rule::enum(PayrollPayoutKind::class)],
            'article_id' => ['required', 'uuid'],
            'paid_at' => ['required', 'date_format:Y-m-d'],
            'comment' => ['nullable', 'string', 'max:500'],
            'items' => ['required', 'array', 'min:1', 'max:500'],
            'items.*.employee_id' => ['bail', 'required', 'uuid', 'distinct', $this->employeeExists()],
            'items.*.amount' => ['required', 'integer', 'min:1'],
        ];
    }
}
