<?php

namespace App\Http\Requests\Workspace;

class UpdateProjectAssignmentHistoryRequest extends ManageProjectAssignmentHistoryRequest
{
    public function rules(): array
    {
        return [
            'is_pm' => ['sometimes', 'boolean'],
            'is_pm_payroll_enabled' => ['sometimes', 'boolean'],
            'started_on' => ['sometimes', 'date_format:Y-m-d'],
            'ended_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
        ];
    }
}
