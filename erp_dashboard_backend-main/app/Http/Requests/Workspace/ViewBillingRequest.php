<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Support\Pagination;
use Illuminate\Validation\Rule;

class ViewBillingRequest extends PermissionRequest {
    protected static function getPermissionAction(): PermissionAction|array {
        return PermissionAction::VIEW;
    }

    protected static function getPermissionSection(): PermissionSection|array {
        return PermissionSection::SETTINGS;
    }

    public function rules(): array {
        return [
            'per_page' => ['nullable', 'integer', Rule::in(Pagination::PER_PAGE_OPTIONS)]
        ];
    }
}