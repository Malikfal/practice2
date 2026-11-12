<?php

namespace App\Http\Requests\Workspace;

use Illuminate\Validation\Rule;

class StoreProjectActivityHistoryRequest extends ManageProjectActivityHistoryRequest
{
    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'project_id' => [
                'required',
                'uuid',
                Rule::exists('projects', 'id')->when(
                    $companyId !== '',
                    fn ($rule) => $rule->where('company_id', $companyId),
                ),
            ],
            'started_on' => ['required', 'date_format:Y-m-d'],
            'ended_on' => ['required', 'date_format:Y-m-d', 'after:started_on'],
        ];
    }
}
