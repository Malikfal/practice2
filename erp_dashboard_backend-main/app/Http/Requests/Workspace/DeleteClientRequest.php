<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class DeleteClientRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::DELETE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::CLIENTS;
    }

    public function rules(): array
    {
        return [];
    }
}
