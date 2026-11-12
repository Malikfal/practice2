<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class RolesAccessRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::VIEW, PermissionAction::MANAGE];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::ROLES;
    }

    public function rules(): array
    {
        return [];
    }
}
