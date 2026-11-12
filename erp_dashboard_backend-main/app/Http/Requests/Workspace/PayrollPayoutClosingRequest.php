<?php

namespace App\Http\Requests\Workspace;

class PayrollPayoutClosingRequest extends PayrollPayoutManageRequest
{
    public function rules(): array
    {
        return [
            'month' => ['required', 'string', PayrollPayoutViewRequest::MONTH_FORMAT],
        ];
    }
}
