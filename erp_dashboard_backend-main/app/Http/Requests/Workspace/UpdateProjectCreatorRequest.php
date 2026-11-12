<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use Illuminate\Validation\Rule;

class UpdateProjectCreatorRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user || ! $project instanceof Project) {
            return false;
        }

        return $user->canPerformProjectAction($project, UserPermission::PROJECTS_CREATE_UPDATE->value);
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
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'created_by_id' => [
                'required',
                'uuid',
                Rule::exists('users', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId))
                    ->where('status', 'ACTIVE'),
            ],
        ];
    }
}
