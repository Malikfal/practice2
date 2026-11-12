<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;

/**
 * Фильтры те же, что в отчете по времени; строки всегда по задачам, поэтому группировки нет.
 */
class OverrunReportRequest extends TimeReportRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::OVERRUN_VIEW;
    }

    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['group_by']);

        return $rules;
    }
}
