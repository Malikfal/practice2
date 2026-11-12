<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class StoreKnowledgeBaseFolderRequest extends PermissionRequest
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
            'name' => ['required', 'string', 'max:255'],
            'access' => ['nullable', 'array'],
            'access.roles' => ['nullable', 'array'],
            'access.roles.*' => ['string', 'distinct'],
            'access.user_ids' => ['nullable', 'array'],
            'access.user_ids.*' => ['uuid', 'distinct'],
        ];
    }
}
