<?php

namespace App\Http\Requests\Workspace;

/** Отчет по выплатам доступен тем же пользователям, что и ведомость. */
class PayrollPayoutReportRequest extends PayrollPayoutViewRequest
{
    public function rules(): array
    {
        return [
            'from' => ['nullable', 'required_with:to', 'date_format:Y-m-d'],
            'to' => ['nullable', 'required_with:from', 'date_format:Y-m-d', 'after_or_equal:from'],
            'employee_id' => ['nullable', 'uuid'],
            'article_id' => ['nullable', 'uuid'],
        ];
    }
}
