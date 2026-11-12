<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\UserPermission;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use Illuminate\Validation\Rule;

class AssignProjectMemberRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();
        $project = $this->route('project');

        if (! $user || ! $project instanceof Project) {
            return false;
        }

        return $user->canPerformProjectAction($project, UserPermission::PROJECT_MEMBERS_MANAGE->value);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECT_MEMBERS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'user_id' => [
                'required',
                Rule::exists('users', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'is_pm' => ['nullable', 'boolean'],
            'is_pm_payroll_enabled' => ['nullable', 'boolean'],
        ];
    }
}
