<?php

namespace App\Http\Requests\Workspace;

use App\Enums\ManagerReportGranularity;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class ManagerReportRequest extends PermissionRequest
{
    protected function prepareForValidation(): void
    {
        $value = $this->input('manager_ids');
        $ids = is_array($value) ? $value : [];

        $this->merge([
            'manager_ids' => array_values(array_unique(array_filter(
                array_map(static fn (mixed $id): string => trim((string) $id), $ids),
                static fn (string $id): bool => $id !== '',
            ))),
        ]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGERS_VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::REPORTS;
    }

    public function rules(): array
    {
        $companyId = (string) $this->attributes->get('company_id', '');
        $userExists = Rule::exists('users', 'id')
            ->when($companyId !== '', fn ($rule) => $rule->where('company_id', $companyId));

        return [
            'from' => ['required', 'date_format:Y-m-d', 'before_or_equal:to'],
            'to' => ['required', 'date_format:Y-m-d', 'after_or_equal:from'],
            'granularity' => ['nullable', Rule::enum(ManagerReportGranularity::class)],
            'manager_ids' => ['nullable', 'array'],
            'manager_ids.*' => ['bail', 'uuid', $userExists],
        ];
    }
}
