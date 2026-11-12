<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class StoreEmployeeDocumentRequest extends PermissionRequest
{
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
        return [
            'document' => [
                'required',
                'file',
                'max:20480', // 20 MB
                'mimes:pdf,doc,docx,png,jpg,jpeg,xls,xlsx,xlm,csv',
            ],
        ];
    }
}
