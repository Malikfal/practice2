<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Http\Requests\Workspace\Concerns\AcceptsImageFileOrUrl;

class StoreProjectNoteImageRequest extends PermissionRequest
{
    use AcceptsImageFileOrUrl;

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::CREATE_UPDATE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS_NOTES;
    }

    public function rules(): array
    {
        return $this->imageRules();
    }
}
