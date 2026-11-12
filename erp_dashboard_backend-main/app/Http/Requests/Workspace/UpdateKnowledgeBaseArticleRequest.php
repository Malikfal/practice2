<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class UpdateKnowledgeBaseArticleRequest extends PermissionRequest
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
            'folder_id' => ['present', 'nullable', 'uuid'],
            'title' => ['present', 'nullable', 'string', 'max:255'],
            'content' => ['present', 'nullable', 'string'],
            'is_archive' => ['required', 'boolean'],
            'is_pinned' => ['required', 'boolean'],
        ];
    }
}
