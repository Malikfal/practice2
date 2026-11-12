<?php

namespace App\Http\Requests\Workspace;

use App\Support\PermissionAccess;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UserTaskBoardRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [
            PermissionAction::VIEW_ALL,
            PermissionAction::VIEW_PROJECT_ASSIGNED,
            PermissionAction::VIEW_ASSIGNED,
        ];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::TASKS;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }
}
