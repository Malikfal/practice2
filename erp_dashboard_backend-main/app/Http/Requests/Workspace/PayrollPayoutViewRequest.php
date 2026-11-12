<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Support\PermissionAccess;

/** Ведомость и задолженность видят те же пользователи, что и расчет ФОТ компании. */
class PayrollPayoutViewRequest extends PermissionRequest
{
    public const MONTH_FORMAT = 'regex:/^\d{4}-(0[1-9]|1[0-2])$/';

    public function authorize(): bool
    {
        return PermissionAccess::canAny($this->user(), [UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES_TABS_SALARY;
    }

    public function rules(): array
    {
        return [
            'month' => ['nullable', 'string', self::MONTH_FORMAT],
        ];
    }
}
