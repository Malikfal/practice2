<?php

namespace App\Http\Requests\Workspace;

use Illuminate\Validation\Rule;

class StoreProjectAssignmentHistoryRequest extends ManageProjectAssignmentHistoryRequest
{
    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'project_id' => [
                'required',
                'string',
                Rule::exists('projects', 'id')->when(
                    $companyId !== '',
                    fn ($rule) => $rule->where('company_id', $companyId),
                ),
            ],
            'user_id' => [
                'required',
                'string',
                Rule::exists('users', 'id')->when(
                    $companyId !== '',
                    fn ($rule) => $rule->where('company_id', $companyId),
                ),
            ],
            'is_pm' => ['sometimes', 'boolean'],
            'is_pm_payroll_enabled' => ['sometimes', 'boolean'],
            'started_on' => ['required', 'date_format:Y-m-d'],
            'ended_on' => ['required', 'date_format:Y-m-d', 'after:started_on'],
        ];
    }
}
