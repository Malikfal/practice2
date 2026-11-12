<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class ShowFinanceSettingsRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::VIEW, PermissionAction::MANAGE];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        // Статьи начисления зарплат показываются в «Оплате труда», доступной по праву на финансы.
        return [PermissionSection::SETTINGS, PermissionSection::FINANCE];
    }

    public function rules(): array
    {
        return [];
    }
}
