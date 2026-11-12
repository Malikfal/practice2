<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;

class SyncProjectTagsRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user || ! $project instanceof Project) {
            return false;
        }

        return parent::authorize() && $user->canAccessAssignedProject($project);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }

    public function rules(): array
    {
        return [
            'tags' => ['present', 'array'],
            'tags.*' => ['required', 'string', 'max:50', 'distinct:ignore_case'],
        ];
    }
}
