<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;

/** Список статей нужен и в настройках финансов, и в окне выплаты. */
class PayrollPayoutArticleIndexRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), [
            UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value,
            UserPermission::FINANCE_VIEW->value,
            UserPermission::FINANCE_MANAGE->value,
        ]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::FINANCE;
    }

    public function rules(): array
    {
        return [];
    }
}
