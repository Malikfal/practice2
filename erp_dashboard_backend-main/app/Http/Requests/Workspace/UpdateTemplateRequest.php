<?php

namespace App\Http\Requests\Workspace;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTemplateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        return [
            'name' => ['required', 'string', 'max:255'],
            'manager_id' => [
                'nullable',
                'uuid',
                Rule::exists('users', 'id')->where('company_id', $companyId),
            ],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => [
                'distinct',
                'uuid',
                Rule::exists('users', 'id')->where('company_id', $companyId),
            ],
        ];
    }
}