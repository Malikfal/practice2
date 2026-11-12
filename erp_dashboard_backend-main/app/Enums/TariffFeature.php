<?php

namespace App\Enums;

/**
 * Возможности тарифа ПРО, закрытые на ФРИ.
 */
enum TariffFeature: string
{
    case TRACKER = 'tracker';
    case FINANCE_ANALYTICS = 'finance_analytics';
    case PAYROLL = 'payroll';
    case PROJECT_ECONOMICS = 'project_economics';
    case CLIENT_ACCESS = 'client_access';
    case ADVANCED_REPORTS = 'advanced_reports';

    public function label(): string
    {
        return match ($this) {
            self::TRACKER => 'Трекер ФЛОУ',
            self::FINANCE_ANALYTICS => 'Финансовая аналитика',
            self::PAYROLL => 'Расчёт начислений и выплат ФОТ',
            self::PROJECT_ECONOMICS => 'Экономика проектов',
            self::CLIENT_ACCESS => 'Клиентский доступ',
            self::ADVANCED_REPORTS => 'Расширенные отчёты',
        };
    }

    /**
     * Права, которые снимаются с пользователей компании на ФРИ.
     *
     * @return array<int, string>
     */
    public function permissions(): array
    {
        return array_map(static fn (UserPermission $permission): string => $permission->value, match ($this) {
            self::PAYROLL => [
                UserPermission::EMPLOYEES_TABS_SALARY_VIEW,
                UserPermission::EMPLOYEES_TABS_CALCULATIONS_VIEW,
            ],
            self::PROJECT_ECONOMICS => [
                UserPermission::PROJECTS_TABS_FINANCE_VIEW,
            ],
            self::CLIENT_ACCESS => [
                UserPermission::CLIENTS_FLOW_ACCESS_MANAGE,
                UserPermission::PROJECTS_TABS_TASKS_CLIENT_VIEW,
                UserPermission::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW,
                UserPermission::PROJECTS_TABS_TASKS_CLIENT_REPLY,
                UserPermission::PROJECTS_TABS_TASKS_CLIENT_STATUS_UPDATE,
                UserPermission::PROJECTS_TABS_TASKS_CLIENT_LINK_MANAGE,
            ],
            self::ADVANCED_REPORTS => [
                UserPermission::REPORTS_MANAGERS_VIEW,
                UserPermission::REPORTS_OVERRUN_VIEW,
                UserPermission::REPORTS_STALE_TASKS_VIEW,
                UserPermission::REPORTS_LIMITS_VIEW,
                UserPermission::REPORTS_HOURS_CHART_VIEW,
            ],
            self::TRACKER, self::FINANCE_ANALYTICS => [],
        });
    }

    /**
     * Маршруты API, закрытые на ФРИ, сверх снятых прав (шаблоны для Request::is).
     *
     * @return array<int, string>
     */
    public function routePatterns(): array
    {
        return match ($this) {
            self::PAYROLL => [
                'api/payroll-payouts*',
                'api/payroll-payout-articles*',
                'api/payroll-recalculations*',
                'api/employees/payroll-*',
                'api/employees/*/payroll-*',
                'api/employees/*/rates*',
                'api/employee-rates*',
            ],
            self::PROJECT_ECONOMICS => [
                'api/projects/*/rates*',
                'api/finance/financial-results*',
            ],
            self::FINANCE_ANALYTICS => [
                'api/finance/analytics*',
                'api/planned-expenses*',
            ],
            self::CLIENT_ACCESS => [
                'api/clients/*/flow-accounts*',
                'api/clients/*/flow-projects',
                'api/tasks/*/client-messages*',
            ],
            // Права уже сняты, шаблоны нужны, чтобы ответ объяснял, что раздел на ПРО.
            self::ADVANCED_REPORTS => [
                'api/reports/managers*',
                'api/reports/overrun*',
                'api/reports/stale-tasks*',
                'api/reports/limits*',
                'api/reports/hours-chart*',
            ],
            self::TRACKER => [],
        };
    }

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_map(static fn (self $feature): string => $feature->value, self::cases());
    }
}
