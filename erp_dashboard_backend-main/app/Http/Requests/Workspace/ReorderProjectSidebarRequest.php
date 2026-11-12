<?php

namespace App\Http\Requests\Workspace;

use Illuminate\Foundation\Http\FormRequest;

class ReorderProjectSidebarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'project_ids' => ['required', 'array'],
            'project_ids.*' => ['required', 'string', 'distinct'],
        ];
    }
}
