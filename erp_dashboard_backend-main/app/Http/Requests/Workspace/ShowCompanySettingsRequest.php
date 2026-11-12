<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Foundation\Http\FormRequest;

class ShowCompanySettingsRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array {
        return PermissionSection::SETTINGS;
    }

    public function rules(): array
    {
        return [];
    }
}
