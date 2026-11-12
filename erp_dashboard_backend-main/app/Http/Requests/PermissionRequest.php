<?php

namespace App\Http\Requests;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Support\PermissionAccess;
use App\Support\RoutePermissions;
use Illuminate\Foundation\Http\FormRequest;

abstract class PermissionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return PermissionAccess::canAny(
            $this->user(),
            RoutePermissions::resolve(static::getPermissionAction(), static::getPermissionSection()),
        );
    }

    /**
     * @return PermissionAction|array<int, PermissionAction>
     */
    abstract protected static function getPermissionAction(): PermissionAction|array;

    /**
     * @return PermissionSection|array<int, PermissionSection>
     */
    abstract protected static function getPermissionSection(): PermissionSection|array;
}
