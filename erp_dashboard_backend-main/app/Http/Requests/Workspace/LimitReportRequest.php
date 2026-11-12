<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Services\Workspace\Reports\LimitReportService;
use Illuminate\Validation\Rule;

/**
 * Фильтры те же, что в отчете по времени; группировка — по проектам или по клиентам.
 */
class LimitReportRequest extends TimeReportRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::LIMITS_VIEW;
    }

    public function rules(): array
    {
        return [
            ...parent::rules(),
            'group_by' => ['sometimes', Rule::in(LimitReportService::GROUPS)],
        ];
    }
}
