<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class EmployeeDayTimelineRequest extends PermissionRequest
{
    public function authorize(): bool
    {
        $user = $this->user();

        if (! $user) {
            return false;
        }

        $targetUserId = (string) $this->input('user_id', '');

        if ($targetUserId !== '' && $targetUserId === (string) $user->id) {
            return true;
        }

        return parent::authorize();
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return [PermissionSection::EMPLOYEES_TABS_DAY, PermissionSection::REPORTS];
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
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after:from'],
        ];
    }
}
