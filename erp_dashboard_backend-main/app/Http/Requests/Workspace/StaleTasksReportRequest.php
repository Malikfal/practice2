<?php

namespace App\Http\Requests\Workspace;

use App\Enums\PermissionAction;

/**
 * Фильтры отчёта по времени без периода и группировки: отчёт — снимок на сегодня, строки всегда по задачам.
 * Дополнительно фильтр по названиям статусов, потому что колонки статусов у каждого проекта свои.
 */
class StaleTasksReportRequest extends TimeReportRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        $value = $this->input('status_names');
        $names = is_array($value) ? $value : ($value === null ? [] : [$value]);

        $this->merge([
            'status_names' => array_values(array_filter(
                array_map(static fn (mixed $name): mixed => is_string($name) ? trim($name) : $name, $names),
                static fn (mixed $name): bool => $name !== '',
            )),
        ]);
    }

    protected static function getPermissionAction(): PermissionAction|array
    {
        return PermissionAction::STALE_TASKS_VIEW;
    }

    public function rules(): array
    {
        $rules = parent::rules();
        unset($rules['from'], $rules['to'], $rules['group_by']);

        return [
            ...$rules,
            'status_names' => ['nullable', 'array'],
            'status_names.*' => ['bail', 'string', 'max:255', 'distinct'],
        ];
    }
}
