<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;
use App\Enums\PermissionSection;
use App\Http\Requests\PermissionRequest;
use App\Models\Tariff;
use Illuminate\Validation\Rule;

class ChangeTariffRequest extends PermissionRequest {

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::MANAGE;
    }

    protected static function getPermissionSection(): PermissionSection|array
    {
        return PermissionSection::SETTINGS;
    }

    public function attributes(): array
    {
        return ['period_months' => 'период оплаты', 'tariff_id' => 'тариф'];
    }

    public function rules(): array
    {
        return [
            'tariff_id' => ['required', 'uuid', 'exists:tariffs,id'],
            // Для ФРИ период не нужен: подписка бессрочная.
            'period_months' => [
                Rule::requiredIf(fn (): bool => ! Tariff::query()->whereKey($this->input('tariff_id'))->where('plan', Tariff::PLAN_FREE)->exists()),
                'nullable', 'integer', 'min:1', 'max:12',
            ],
        ];
    }

}