<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class StoreProjectDocumentRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS_DOCUMENTS;
    }

    public function rules(): array
    {
        return [
            'document' => [
                'required',
                'file',
            ],
            'is_client_visible' => ['sometimes', 'boolean'],
        ];
    }
}
