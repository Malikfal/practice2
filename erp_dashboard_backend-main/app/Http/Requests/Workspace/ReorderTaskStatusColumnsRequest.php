<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class ReorderTaskStatusColumnsRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TASKS_STATUS;
    }

    public function rules(): array
    {
        return [
            'columns' => ['required', 'array'],
            'columns.*.id' => ['required', 'uuid', 'distinct'],
            'columns.*.position' => ['required', 'integer', 'min:1'],
        ];
    }
}
