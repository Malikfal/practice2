<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class StoreClientLegalEntityBankDetailRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::CLIENTS;
    }

    public function rules(): array
    {
        return [
            'checking_account' => ['required', 'string', 'max:64'],
            'bank' => ['required', 'string', 'max:255'],
            'bik' => ['required', 'string', 'max:32'],
            'correspondent_account' => ['required', 'string', 'max:64'],
        ];
    }
}
