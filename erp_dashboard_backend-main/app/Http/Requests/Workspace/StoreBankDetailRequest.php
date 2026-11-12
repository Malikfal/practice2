<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;

class StoreBankDetailRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), ['employees.tabs.salary.view']);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW_LIST;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [
            'details' => ['required', 'string', 'max:10000'],
        ];
    }
}
