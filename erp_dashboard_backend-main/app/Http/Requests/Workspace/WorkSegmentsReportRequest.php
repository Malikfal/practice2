<?php

namespace App\Http\Requests\Workspace;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WorkSegmentsReportRequest extends FormRequest
{
    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'start' => ['required', 'date'],
            'end' => ['required', 'date', 'after:start'],
            'userId' => [
                'nullable',
                Rule::exists('users', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
        ];
    }
}
