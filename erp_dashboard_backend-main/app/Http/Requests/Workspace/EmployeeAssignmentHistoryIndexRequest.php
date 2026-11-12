<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\User;

class EmployeeAssignmentHistoryIndexRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $actor = $this->user();
        $employee = $this->route('employee');

        return $actor && $employee instanceof User
            && parent::authorize()
            && $actor->hasCompanyAccess((string) $employee->company_id);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECT_ASSIGNMENT_HISTORIES;
    }

    public function rules(): array
    {
        return [
            'project_ids' => ['sometimes', 'array'],
            'project_ids.*' => ['string', 'distinct'],
        ];
    }
}
