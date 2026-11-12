<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;
use App\Support\Pagination;
use App\Support\RoutePermissions;
use Illuminate\Validation\Rule;

class EmployeeIndexRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), RoutePermissions::EMPLOYEES_INDEX_ANY);
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
            'status' => ['nullable', Rule::in(['all', 'active', 'blocked'])],
            'search' => ['nullable', 'string', 'max:255'],
            'sort_by' => ['nullable', Rule::in([
                'last_name', 'first_name', 'role', 'position',
                'created_at', 'last_date_activity', 'projects', 'total_seconds_for_week',
            ])],
            'sort_direction' => ['nullable', Rule::in(['asc', 'desc'])],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', Rule::in(Pagination::PER_PAGE_OPTIONS)],
        ];
    }
}
