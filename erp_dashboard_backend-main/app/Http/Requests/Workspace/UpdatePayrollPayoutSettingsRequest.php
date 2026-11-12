<?php

namespace App\Http\Requests\Workspace;

class UpdatePayrollPayoutSettingsRequest extends PayrollPayoutManageRequest
{
    public function rules(): array
    {
        return [
            'start_month' => ['required', 'string', PayrollPayoutViewRequest::MONTH_FORMAT],
        ];
    }
}
