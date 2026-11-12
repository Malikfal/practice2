<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class DeleteTimeEntryRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::DELETE_SELF, PermissionAction::DELETE_OTHERS, PermissionAction::DELETE_ALL];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TIME;
    }

    public function rules(): array
    {
        return [
            "delete_from" => ['required', 'integer', 'min:0'],
            "delete_to" => ['required', 'integer', 'min:0'],
        ];
    }
}
