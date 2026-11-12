<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class DeleteEmployeeRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::DELETE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [];
    }
}
