<?php

namespace App\Http\Requests\Workspace;

use App\Enums\NotificationEvent;
use App\Enums\NotificationRelation;
use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use Illuminate\Validation\Rule;

class UpdateNotificationSettingsRequest extends PermissionRequest
{
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
        return [
            'rules' => ['required', 'array'],
            'rules.*.event' => ['required', 'string', Rule::enum(NotificationEvent::class)],
            'rules.*.relation' => ['required', 'string', Rule::enum(NotificationRelation::class)],
            'rules.*.enabled' => ['required', 'boolean'],
        ];
    }
}
