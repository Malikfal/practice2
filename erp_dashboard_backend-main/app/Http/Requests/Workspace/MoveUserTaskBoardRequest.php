<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class MoveUserTaskBoardRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MOVE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TASKS;
    }

    public function rules(): array
    {
        return [
            "status_slug" => ["required", "string", "max:255"],
            "destination_index" => ["required", "integer", "min:0"],
            "search" => ["nullable", "string", "max:255"],
        ];
    }
}
