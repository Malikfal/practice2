<?php

namespace App\Http\Resources\Workspace;

use App\Enums\UserPermission;
use App\Models\User;
use App\Support\RoleCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
final class EmployeeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();

        return [
            'id' => (string) $this->id,
            'email' => $this->email,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'role' => $this->role,
            'role_label' => RoleCatalog::labelForRole((string) $this->company_id, (string) $this->role),
            'status' => $this->status,
            'archived_at' => $this->archived_at?->toDateString(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,

            $this->mergeWhen($this->canViewGeneralData($viewer), [
                'position' => $this->position,
                'birthday' => $this->birthday,
                'phone' => $this->phone,
                'socials' => empty($this->socials) ? (object) [] : $this->socials,
                'skills' => $this->skills,
                'payload' => empty($this->payload) ? (object) [] : $this->payload,
            ]),

            $this->mergeWhen($this->canViewWorkActivity($viewer), [
                'total_seconds_for_week' => (int) ($this->total_seconds_for_week ?? 0),
                'total_seconds_for_day' => (int) ($this->total_seconds_for_day ?? 0),
                // null у тех, кто не менеджер: фронт тогда не показывает строку часов под контролем.
                'supervised_seconds_for_week' => $this->supervised_seconds_for_week ?? null,
                'supervised_seconds_for_day' => $this->supervised_seconds_for_day ?? null,
                // null у тех, у кого нет ставки за часы всей компании: фронт тогда не показывает эту строку.
                'company_seconds_for_week' => $this->company_seconds_for_week ?? null,
                'company_seconds_for_day' => $this->company_seconds_for_day ?? null,
                'total_seconds' => (int) ($this->total_seconds ?? 0),
                'last_date_activity' => $this->last_date_activity !== null
                    ? (int) $this->last_date_activity
                    : null,
            ]),

            // План нужен и в карточке (общие данные), и в колонке «Время за неделю/план».
            $this->mergeWhen($this->canViewGeneralData($viewer) || $this->canViewWorkActivity($viewer), [
                'weekly_plan_seconds' => $this->weekly_plan_seconds,
            ]),

            $this->mergeWhen($this->canViewSalary($viewer), [
                'salary_finance_article_id' => $this->salary_finance_article_id
                    ? (string) $this->salary_finance_article_id
                    : null,
            ]),

            $this->mergeWhen($this->canViewPermissions($viewer), [
                'permissions' => $this->effectivePermissionNames()->values()->all(),
                'role_permissions' => $this->rolePermissionNames()->values()->all(),
                'direct_permissions' => $this->getDirectPermissions()->pluck('name')->values()->all(),
                'denied_permissions' => $this->deniedPermissionNames()->values()->all(),
            ]),
        ];
    }

    private function canViewGeneralData(?User $viewer): bool
    {
        if (! $viewer) {
            return false;
        }

        return $viewer->can(UserPermission::EMPLOYEES_TABS_GENERAL_VIEW->value)
            || $viewer->can(UserPermission::EMPLOYEES_CREATE_UPDATE->value);
    }

    private function canViewWorkActivity(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::EMPLOYEES_TABS_DAY_VIEW->value) ?? false;
    }

    private function canViewPermissions(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::ROLES_MANAGE->value) ?? false;
    }

    /**
     * Проверяет доступ к настройкам оплаты труда сотрудника.
     */
    private function canViewSalary(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::EMPLOYEES_TABS_SALARY_VIEW->value) ?? false;
    }
}
