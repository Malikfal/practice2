<?php

namespace App\Http\Requests\Workspace;

use App\Enums\Currency;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Project;
use Illuminate\Validation\Rule;

class StoreProjectRateRequest extends PermissionRequest
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
            'rate' => ['nullable', 'integer', 'min:0'],
            'vat' => ['nullable', 'integer', 'min:0'],
            'currency' => ['sometimes', Rule::enum(Currency::class)],
            'effective_from' => ['required', 'date'],
        ];
    }
}
