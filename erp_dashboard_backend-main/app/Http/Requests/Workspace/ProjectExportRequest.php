<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class ProjectExportRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::VIEW_ALL, PermissionAction::VIEW_ASSIGNED];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(['all', 'active', 'archived'])],
            'search' => ['nullable', 'string', 'max:255'],
        ];
    }
}
