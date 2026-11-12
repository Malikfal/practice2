<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class EmployeeDocumentsViewRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        if (! $user) {
            return false;
        }

        $employee = $this->route('employee');
        if ($employee && (string) $employee->id === (string) $user->id) {
            return true;
        }

        $document = $this->route('document');
        if ($document && (string) $document->employee_id === (string) $user->id) {
            return true;
        }

        return parent::authorize();
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES_TABS_DOCUMENTS;
    }

    public function rules(): array
    {
        return [];
    }
}
