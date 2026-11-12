<?php

namespace App\Http\Requests\Workspace;

class SavePayrollPayoutArticleRequest extends PayrollPayoutArticleManageRequest
{
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
        ];
    }
}
