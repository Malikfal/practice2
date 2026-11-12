<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class CancelInvoiceRequest extends PermissionRequest {

    public function authorize(): bool {
        if (!parent::authorize()) return false;
        $invoice = $this->route('invoice');
        return $invoice && $invoice->company_id === $this->user()->company_id;
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::SETTINGS;
    }

    public function rules(): array
    {
        return [];
    }

}