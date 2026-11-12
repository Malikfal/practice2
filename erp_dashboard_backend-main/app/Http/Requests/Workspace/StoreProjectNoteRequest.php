<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\ProjectNoteVisibility;
use App\Http\Requests\PermissionRequest;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rule;

class StoreProjectNoteRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS_NOTES;
    }

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'title' => ['nullable', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'visibility' => ['nullable', 'string', Rule::in(ProjectNoteVisibility::values())],
            'visible_user_ids' => ['nullable', 'array'],
            'visible_user_ids.*' => ['string', 'distinct'],
            'access' => ['nullable', 'array'],
            'access.roles' => ['nullable', 'array'],
            'access.roles.*' => ['string', 'distinct'],
            'access.user_ids' => ['nullable', 'array'],
            'access.user_ids.*' => ['string', 'distinct'],
        ];
    }
}
