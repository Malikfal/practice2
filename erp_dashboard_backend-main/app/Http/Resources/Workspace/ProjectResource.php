<?php

namespace App\Http\Resources\Workspace;

use App\Enums\Currency;
use App\Enums\ProjectManagerPaymentMethod;
use App\Enums\ProjectPayrollExclusionScope;
use App\Enums\ProjectStatus;
use App\Enums\UserPermission;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Project
 */
final class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $viewer = $request->user();
        $status = $this->status instanceof ProjectStatus
            ? $this->status
            : ProjectStatus::tryFrom((string) $this->status) ?? ProjectStatus::ACTIVE;
        $managerPaymentMethod = $this->manager_payment_method instanceof ProjectManagerPaymentMethod
            ? $this->manager_payment_method
            : ProjectManagerPaymentMethod::tryFrom((string) $this->manager_payment_method)
                ?? ProjectManagerPaymentMethod::ACCRUE_ALL;
        $payrollExclusionScope = $this->payroll_exclusion_scope instanceof ProjectPayrollExclusionScope
            ? $this->payroll_exclusion_scope
            : ProjectPayrollExclusionScope::tryFrom((string) $this->payroll_exclusion_scope)
                ?? ProjectPayrollExclusionScope::ALL;

        return [
            'id' => (string) $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $status->value,
            'status_label' => $status->label(),
            'latest_activity_period' => $this->latestActivityHistory ? [
                'id' => (string) $this->latestActivityHistory->id,
                'started_on' => $this->latestActivityHistory->started_on?->toDateString(),
                'ended_on' => $this->latestActivityHistory->ended_on?->toDateString(),
                'is_current' => $this->latestActivityHistory->ended_on === null,
            ] : null,
            'tracker_default_status_name' => trim(
                (string) ($this->company?->tracker_default_task_status_name ?? '')
            ) ?: 'В работе',
            'client' => $this->client ? [
                'id' => (string) $this->client->id,
                'name' => $this->client->name,
            ] : null,
            'client_id' => $this->client_id ? (string) $this->client_id : null,
            'starts_at' => $this->starts_at?->toISOString(),
            'ends_at' => $this->ends_at?->toISOString(),
            'manager_payment_method' => $managerPaymentMethod->value,
            'manager_payment_method_label' => $managerPaymentMethod->label(),
            'is_internal' => (bool) $this->is_internal,
            'exclude_from_payroll' => (bool) $this->exclude_from_payroll,
            'payroll_exclusion_scope' => $payrollExclusionScope->value,
            'payroll_excluded_employee_ids' => $this->payrollExcludedEmployees
                ->pluck('id')
                ->map(static fn ($id): string => (string) $id)
                ->values()
                ->all(),
            'members' => ProjectMemberResource::collection($this->members)->resolve($request),

            $this->mergeWhen($this->canViewProjectMeta($viewer), [
                'created_by_id' => (string) $this->created_by_id,
            ]),

            $this->mergeWhen($this->canViewReports($viewer), [
                'weekly_seconds' => (int) ($this->weekly_seconds ?? 0),
                'daily_seconds' => (int) ($this->daily_seconds ?? 0),
            ]),

            $this->mergeWhen($this->canViewReports($viewer), [
                'total_seconds' => (int) ($this->total_seconds ?? 0),
            ]),

            $this->mergeWhen($this->canViewAbout($viewer), [
                'default_entrance_finance_article_id' => $this->default_entrance_finance_article_id
                    ? (string) $this->default_entrance_finance_article_id
                    : null,
                'current_rate' => $this->current_rate ? [
                    'id' => (string) $this->current_rate->id,
                    'rate' => $this->current_rate->rate,
                    'vat' => $this->current_rate->vat,
                    'currency' => $this->current_rate->currency->value,
                    'effective_from' => $this->current_rate->effective_from?->toDateString(),
                ] : null,
                'tags' => ProjectTagResource::collection($this->tags)->resolve($request),
                'weekly_limit_seconds' => $this->weekly_limit_seconds,
                // Лимит клиента главнее лимита проекта, вкладка «О проекте» подсказывает это.
                'client_weekly_limit_seconds' => $this->client?->weekly_limit_seconds,
            ]),

            $this->mergeWhen($this->canViewFinance($viewer), [
                'weekly_amount' => (int) ($this->weekly_amount ?? 0),
                // Сумма за неделю считается по текущей ставке и в её валюте.
                'weekly_amount_currency' => $this->current_rate?->currency->value ?? Currency::RUB->value,
                'budget' => $this->budget,
            ]),
        ];
    }

    private function canViewProjectMeta(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::PROJECTS_CREATE_UPDATE->value) ?? false;
    }

    private function canViewAbout(?User $viewer): bool
    {
        return $viewer?->can(UserPermission::PROJECTS_TABS_ABOUT_VIEW->value) ?? false;
    }

    private function canViewReports(?User $viewer): bool
    {
        if (! $viewer) {
            return false;
        }

        return $viewer->can(UserPermission::PROJECTS_TABS_REPORTS_VIEW->value)
            || $viewer->can(UserPermission::REPORTS_VIEW->value);
    }

    private function canViewFinance(?User $viewer): bool
    {
        if (! $viewer) {
            return false;
        }

        return $viewer->can(UserPermission::PROJECTS_TABS_FINANCE_VIEW->value)
            || $viewer->can(UserPermission::FINANCE_VIEW->value)
            || $viewer->can(UserPermission::FINANCE_MANAGE->value);
    }
}
