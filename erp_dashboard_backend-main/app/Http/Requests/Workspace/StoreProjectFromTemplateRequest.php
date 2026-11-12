<?php

namespace App\Http\Requests\Workspace;

use App\Enums\Currency;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Enums\ProjectStatus;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class StoreProjectFromTemplateRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return [PermissionAction::VIEW_ALL, PermissionAction::VIEW_ASSIGNED];
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::PROJECTS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');

        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', Rule::in(ProjectStatus::values())],
            'client_id' => [
                'nullable',
                'uuid',
                Rule::exists('clients', 'id')
                    ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId)),
            ],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'budget' => ['nullable', 'integer', 'min:0'],
            // Начальная ставка проекта в копейках/центах, действует с даты создания.
            'rate' => ['nullable', 'integer', 'min:0'],
            'rate_currency' => ['sometimes', Rule::enum(Currency::class)],
            'rate_vat' => ['nullable', 'integer', 'min:0'],
        ];
    }
}
