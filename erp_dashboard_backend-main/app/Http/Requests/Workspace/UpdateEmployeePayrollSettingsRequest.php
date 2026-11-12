<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateEmployeePayrollSettingsRequest extends PermissionRequest
{
    /**
     * Возвращает действие раздела для базовой permission-проверки.
     */
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    /**
     * Возвращает раздел сотрудников для базовой permission-проверки.
     */
    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES_TABS_SALARY;
    }

    /**
     * Возвращает правила базовой проверки индивидуальной статьи.
     */
    public function rules(): array
    {
        return [
            'salary_finance_article_id' => ['present', 'nullable', 'uuid'],
        ];
    }
}
