<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class StoreTemplateRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        return [
            'name' => ['required', 'string', 'max:255'],
            'is_default_template' => ['sometimes', 'boolean'],
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
            'status_columns' => ['nullable', 'array', 'min:1'],
            'status_columns.*.name' => ['required', 'string', 'max:255'],
            'status_columns.*.color' => ['nullable', 'string', 'max:32'],
            'status_columns.*.is_final' => ['sometimes', 'boolean'],
        ];
    }
}
