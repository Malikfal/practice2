<?php

namespace App\Http\Requests\Admin;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;

class ChangeEmployeePasswordRequest extends PermissionRequest
{
    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::PASSWORD_RESET;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::EMPLOYEES;
    }

    public function rules(): array
    {
        return [
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ];
    }

    public function messages(): array
    {
        return [
            'password.required' => 'Укажите новый пароль.',
            'password.min' => 'Новый пароль должен быть не короче 8 символов.',
            'password.confirmed' => 'Новый пароль и повтор нового пароля не совпадают.',
        ];
    }
}
