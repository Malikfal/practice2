<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateKnowledgeBaseFolderRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::KNOWLEDGE_BASE;
    }

    public function rules(): array
    {
        return [
            'name' => ['present', 'nullable', 'string', 'max:255'],
            'is_archive' => ['present', 'nullable', 'boolean'],
        ];
    }
}
