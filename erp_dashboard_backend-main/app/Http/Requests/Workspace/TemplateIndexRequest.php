<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\Pagination;
use Illuminate\Validation\Rule;

class TemplateIndexRequest extends PermissionRequest
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
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', Rule::in(Pagination::PER_PAGE_OPTIONS)],
        ];
    }
}
