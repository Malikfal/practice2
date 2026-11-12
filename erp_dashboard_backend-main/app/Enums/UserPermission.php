<?php

namespace App\Enums;

enum UserPermission: string
{
    case TIME_ADD_FOR_OTHERS = 'time.add_for_others';
    case TIME_ADD_FOR_PROJECT_USERS = 'time.add_for_project_users';
    case TIME_ADD_FOR_ALL = 'time.add_for_all';
    case TIME_VIEW_SELF = 'time.view_self';
    case TIME_VIEW_OTHERS = 'time.view_others';
    case TIME_VIEW_ALL = 'time.view_all';
    case TIME_DELETE_SELF = 'time.delete_self';
    case TIME_DELETE_OTHERS = 'time.delete_others';
    case TIME_DELETE_ALL = 'time.delete_all';

    case EMPLOYEES_VIEW_LIST = 'employees.view_list';
    case EMPLOYEES_CREATE_UPDATE = 'employees.create_update';
    case EMPLOYEES_DELETE = 'employees.delete';
    case EMPLOYEES_PASSWORD_RESET = 'employees.password.reset';
    case EMPLOYEES_TABS_DAY_VIEW = 'employees.tabs.day.view';
    case EMPLOYEES_TABS_GENERAL_VIEW = 'employees.tabs.general.view';
    case EMPLOYEES_TABS_SETTINGS_VIEW = 'employees.tabs.settings.view';
    case EMPLOYEES_TABS_DOCUMENTS_VIEW = 'employees.tabs.documents.view';
    case EMPLOYEES_TABS_SALARY_VIEW = 'employees.tabs.salary.view';
    case EMPLOYEES_TABS_CALCULATIONS_VIEW = 'employees.tabs.calculations.view';
    case EMPLOYEES_TABS_ABSENCES_VIEW = 'employees.tabs.absences.view';
    case EMPLOYEES_ABSENCES_MANAGE = 'employees.absences.manage';

    // case PROJECTS_MANAGE = 'projects.manage'; //
    case PROJECTS_VIEW_ALL = 'projects.view_all';
    case PROJECTS_VIEW_ASSIGNED = 'projects.view_assigned';
    case PROJECTS_CREATE_UPDATE = 'projects.create_update';
    case PROJECTS_DELETE = 'projects.delete';
    // case PROJECTS_BUDGET_VIEW = 'projects.budget.view'; //
    // case PROJECTS_BUDGET_UPDATE = 'projects.budget.update'; //
    case PROJECTS_TABS_ABOUT_VIEW = 'projects.tabs.about.view';
    case PROJECTS_TABS_TASKS_VIEW = 'projects.tabs.tasks.view';
    case PROJECTS_TABS_NOTES_VIEW = 'projects.tabs.notes.view';
    case PROJECTS_TABS_DOCUMENTS_VIEW = 'projects.tabs.documents.view';
    case PROJECTS_TABS_REPORTS_VIEW = 'projects.tabs.reports.view';
    case PROJECTS_TABS_FINANCE_VIEW = 'projects.tabs.finance.view';
    case PROJECTS_NOTES_CREATE_UPDATE = 'projects.notes.create_update';
    case PROJECTS_NOTES_DELETE = 'projects.notes.delete';
    // case PROJECTS_NOTES_ASSIGN = 'projects.notes.assign'; //
    case PROJECTS_DOCUMENTS_CREATE_UPDATE = 'projects.documents.create_update';
    case PROJECTS_DOCUMENTS_DELETE = 'projects.documents.delete';
    // case PROJECTS_DOCUMENTS_ASSIGN = 'projects.documents.assign'; //
    case PROJECT_MEMBERS_MANAGE = 'project.members.manage'; //
    case PROJECT_ASSIGNMENT_HISTORIES_VIEW = 'project.assignment_histories.view';
    case PROJECT_ASSIGNMENT_HISTORIES_MANAGE = 'project.assignment_histories.manage';
    case PROJECT_ACTIVITY_HISTORIES_VIEW = 'project.activity_histories.view';
    case PROJECT_ACTIVITY_HISTORIES_MANAGE = 'project.activity_histories.manage';

    case TASKS_VIEW_ALL = 'tasks.view_all';
    case TASKS_VIEW_PROJECT_ASSIGNED = 'tasks.view_project_assigned';
    case TASKS_VIEW_ASSIGNED = 'tasks.view_assigned';
    case TASKS_CREATE_UPDATE = 'tasks.create_update';
    // case TASKS_DELETE = 'tasks.delete';
    case TASKS_ASSIGN = 'tasks.assign';
    case TASKS_STATUS_CREATE_UPDATE = 'tasks.status.create_update';
    case TASKS_STATUS_VIEW = 'tasks.status.view';
    case TASKS_STATUS_DELETE = 'tasks.status.delete';
    case TASKS_MOVE = 'tasks.move';
    case PROJECTS_TABS_TASKS_CLIENT_VIEW = 'projects.tabs.tasks.client.view';
    case PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW = 'projects.tabs.tasks.client.comments.view';
    case PROJECTS_TABS_TASKS_CLIENT_REPLY = 'projects.tabs.tasks.client.reply';
    case PROJECTS_TABS_TASKS_CLIENT_STATUS_UPDATE = 'projects.tabs.tasks.client.status.update';
    case PROJECTS_TABS_TASKS_CLIENT_LINK_MANAGE = 'projects.tabs.tasks.client.link.manage';
    case PROJECTS_TABS_TASKS_COMMENTS_DELETE_SELF = 'projects.tabs.tasks.comments.delete_self';
    case PROJECTS_TABS_TASKS_COMMENTS_DELETE_ALL = 'projects.tabs.tasks.comments.delete_all';
    case PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_SELF = 'projects.tabs.tasks.attachments.delete_self';
    case PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_ALL = 'projects.tabs.tasks.attachments.delete_all';
    case REPORTS_VIEW = 'reports.view';
    case REPORTS_TASKS_VIEW = 'reports.tasks.view';
    case REPORTS_MANAGERS_VIEW = 'reports.managers.view';
    case REPORTS_OVERRUN_VIEW = 'reports.overrun.view';
    case REPORTS_STALE_TASKS_VIEW = 'reports.stale_tasks.view';
    case REPORTS_LIMITS_VIEW = 'reports.limits.view';
    case REPORTS_HOURS_CHART_VIEW = 'reports.hours_chart.view';

    case FINANCE_VIEW = 'finance.view';
    case FINANCE_MANAGE = 'finance.manage';

    case CLIENTS_VIEW = 'clients.view';
    case CLIENTS_CREATE_UPDATE = 'clients.create_update';
    case CLIENTS_DELETE = 'clients.delete';
    case CLIENTS_FLOW_ACCESS_MANAGE = 'clients.flow_access.manage';

    // Права клиентского кабинета: выдаются только роли «Клиент».
    case CLIENT_PORTAL_ATTACHMENTS_UPLOAD = 'client_portal.attachments.upload';
    case CLIENT_PORTAL_TASK_DESCRIPTION_VIEW = 'client_portal.task.description.view';
    case CLIENT_PORTAL_TASK_ESTIMATION_VIEW = 'client_portal.task.estimation.view';
    case CLIENT_PORTAL_TASK_PRIORITY_VIEW = 'client_portal.task.priority.view';
    case CLIENT_PORTAL_TASK_DEADLINE_VIEW = 'client_portal.task.deadline.view';
    case CLIENT_PORTAL_TASK_PRIORITY_UPDATE = 'client_portal.task.priority.update';
    case CLIENT_PORTAL_TASK_DEADLINE_SET = 'client_portal.task.deadline.set';
    case CLIENT_PORTAL_TASK_SPENT_TIME_VIEW = 'client_portal.task.spent_time.view';

    case KNOWLEDGE_BASE_VIEW_ALL = 'knowledge_base.view_all';
    case KNOWLEDGE_BASE_VIEW_ASSIGNED = 'knowledge_base.view_assigned';
    case KNOWLEDGE_BASE_CREATE_UPDATE = 'knowledge_base.create_update';
    case KNOWLEDGE_BASE_DELETE = 'knowledge_base.delete';

    case SETTINGS_VIEW = 'settings.view';
    case SETTINGS_MANAGE = 'settings.manage';

    case ROLES_VIEW = 'roles.view';
    case ROLES_MANAGE = 'roles.manage';

    public function label(): string
    {
        return match ($this) {
            self::TIME_ADD_FOR_OTHERS => 'Добавление времени за других',
            self::TIME_ADD_FOR_PROJECT_USERS => 'Добавление времени за участников доступного проекта',
            self::TIME_ADD_FOR_ALL => 'Добавление времени полный доступ',
            self::TIME_VIEW_SELF => 'Просмотр своего времени',
            self::TIME_VIEW_OTHERS => 'Просмотр времени других в назначенном проекте',
            self::TIME_VIEW_ALL => 'Просмотр всего времени',
            self::TIME_DELETE_SELF => 'Удаление своего времени',
            self::TIME_DELETE_OTHERS => 'Удаление чужого времени в назначенном проекте',
            self::TIME_DELETE_ALL => 'Удаление полный доступ',
            self::EMPLOYEES_VIEW_LIST => 'Список сотрудников',
            self::EMPLOYEES_CREATE_UPDATE => 'Создание и редактирование сотрудника',
            self::EMPLOYEES_DELETE => 'Удаление сотрудника',
            self::EMPLOYEES_PASSWORD_RESET => 'Сброс пароля сотрудника',
            self::EMPLOYEES_TABS_DAY_VIEW => 'Вкладка сотрудника: день сотрудника',
            self::EMPLOYEES_TABS_GENERAL_VIEW => 'Вкладка сотрудника: общие данные',
            self::EMPLOYEES_TABS_SETTINGS_VIEW => 'Вкладка сотрудника: настройки',
            self::EMPLOYEES_TABS_DOCUMENTS_VIEW => 'Вкладка сотрудника: документы',
            self::EMPLOYEES_TABS_SALARY_VIEW => 'Вкладка сотрудника: оплата труда',
            self::EMPLOYEES_TABS_CALCULATIONS_VIEW => 'Вкладка сотрудника: расчеты',
            self::EMPLOYEES_TABS_ABSENCES_VIEW => 'Вкладка сотрудника: рабочий календарь',
            self::EMPLOYEES_ABSENCES_MANAGE => 'Управление отпусками и отгулами сотрудника',
            // self::PROJECTS_MANAGE => 'Управление проектами',
            self::PROJECTS_VIEW_ALL => 'Просмотр всех проектов',
            self::PROJECTS_VIEW_ASSIGNED => 'Просмотр назначенных проектов',
            self::PROJECTS_CREATE_UPDATE => 'Создание и редактирование проекта',
            self::PROJECTS_DELETE => 'Архивирование проекта',
            // self::PROJECTS_BUDGET_VIEW => 'Просмотр бюджета проекта',
            // self::PROJECTS_BUDGET_UPDATE => 'Редактирование бюджета проекта',
            self::PROJECTS_TABS_ABOUT_VIEW => 'Вкладка проекта: о проекте',
            self::PROJECTS_TABS_TASKS_VIEW => 'Вкладка проекта: задачи',
            self::PROJECTS_TABS_NOTES_VIEW => 'Вкладка проекта: заметки',
            self::PROJECTS_TABS_DOCUMENTS_VIEW => 'Вкладка проекта: документы',
            self::PROJECTS_TABS_REPORTS_VIEW => 'Вкладка проекта: отчеты',
            self::PROJECTS_TABS_FINANCE_VIEW => 'Вкладка проекта: финансы',
            self::PROJECTS_NOTES_CREATE_UPDATE => 'Добавление и редактирование заметок проекта',
            self::PROJECTS_NOTES_DELETE => 'Удаление заметок проекта',
            // self::PROJECTS_NOTES_ASSIGN => 'Назначение заметок проекта',
            self::PROJECTS_DOCUMENTS_CREATE_UPDATE => 'Добавление и редактирование документов проекта',
            self::PROJECTS_DOCUMENTS_DELETE => 'Удаление документов проекта',
            // self::PROJECTS_DOCUMENTS_ASSIGN => 'Назначение документов проекта',
            self::PROJECT_MEMBERS_MANAGE => 'Управление участниками проектов',
            self::PROJECT_ASSIGNMENT_HISTORIES_VIEW => 'Просмотр истории назначений на проекты',
            self::PROJECT_ASSIGNMENT_HISTORIES_MANAGE => 'Управление историей назначений на проекты',
            self::PROJECT_ACTIVITY_HISTORIES_VIEW => 'Просмотр истории активности проектов',
            self::PROJECT_ACTIVITY_HISTORIES_MANAGE => 'Управление историей активности проектов',
            self::TASKS_VIEW_ALL => 'Просмотр всех задач',
            self::TASKS_VIEW_PROJECT_ASSIGNED => 'Просмотр задач в назначенных проектах',
            self::TASKS_VIEW_ASSIGNED => 'Просмотр назначенных задач',
            self::TASKS_CREATE_UPDATE => 'Создание и редактирование задач',
            // self::TASKS_DELETE => 'Удаление задач',
            self::TASKS_ASSIGN => 'Назначение задач',
            self::TASKS_STATUS_CREATE_UPDATE => 'Создание статуса задач',
            self::TASKS_STATUS_VIEW => 'Просмотр статусов задач',
            self::TASKS_STATUS_DELETE => 'Удаление статусов задач',
            self::TASKS_MOVE => 'Перемещение задач',
            self::PROJECTS_TABS_TASKS_CLIENT_VIEW => 'Просмотр вкладки «Клиент»',
            self::PROJECTS_TABS_TASKS_CLIENT_COMMENTS_VIEW => 'Просмотр комментариев клиента',
            self::PROJECTS_TABS_TASKS_CLIENT_REPLY => 'Отправка ответа клиенту',
            self::PROJECTS_TABS_TASKS_CLIENT_STATUS_UPDATE => 'Изменение статуса согласования',
            self::PROJECTS_TABS_TASKS_CLIENT_LINK_MANAGE => 'Создание и отключение клиентской ссылки',
            self::PROJECTS_TABS_TASKS_COMMENTS_DELETE_SELF => 'Удаление своих комментариев к задачам',
            self::PROJECTS_TABS_TASKS_COMMENTS_DELETE_ALL => 'Удаление всех комментариев к задачам',
            self::PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_SELF => 'Удаление своих вложений к задаче',
            self::PROJECTS_TABS_TASKS_ATTACHMENTS_DELETE_ALL => 'Удаление всех вложений к задаче',
            self::REPORTS_VIEW => 'Просмотр отчётов по времени',
            self::REPORTS_TASKS_VIEW => 'Просмотр отчётов по задачам',
            self::REPORTS_MANAGERS_VIEW => 'Просмотр отчёта по менеджерам',
            self::REPORTS_OVERRUN_VIEW => 'Просмотр отчёта по перерасходу',
            self::REPORTS_STALE_TASKS_VIEW => 'Просмотр отчёта «Задачи без движения»',
            self::REPORTS_LIMITS_VIEW => 'Просмотр отчёта «Лимитные проекты»',
            self::REPORTS_HOURS_CHART_VIEW => 'Просмотр графического отчёта по часам',
            self::FINANCE_VIEW => 'Просмотр финансов',
            self::FINANCE_MANAGE => 'Управление финансами',
            self::CLIENTS_VIEW => 'Список клиентов',
            self::CLIENTS_CREATE_UPDATE => 'Добавление и редактирование клиентов',
            self::CLIENTS_DELETE => 'Удаление клиентов',
            self::CLIENTS_FLOW_ACCESS_MANAGE => 'Управление доступом клиентов в ФЛОУ',
            self::CLIENT_PORTAL_ATTACHMENTS_UPLOAD => 'Прикрепление файлов к комментариям',
            self::CLIENT_PORTAL_TASK_DESCRIPTION_VIEW => 'Просмотр описания задачи',
            self::CLIENT_PORTAL_TASK_ESTIMATION_VIEW => 'Просмотр оценки времени',
            self::CLIENT_PORTAL_TASK_PRIORITY_VIEW => 'Просмотр приоритета',
            self::CLIENT_PORTAL_TASK_DEADLINE_VIEW => 'Просмотр дедлайна',
            self::CLIENT_PORTAL_TASK_PRIORITY_UPDATE => 'Изменение приоритета',
            self::CLIENT_PORTAL_TASK_DEADLINE_SET => 'Установка дедлайна, если он не задан',
            self::CLIENT_PORTAL_TASK_SPENT_TIME_VIEW => 'Просмотр затраченного времени',
            self::KNOWLEDGE_BASE_VIEW_ALL => 'База знаний: весь список',
            self::KNOWLEDGE_BASE_VIEW_ASSIGNED => 'База знаний: назначенное тебе',
            self::KNOWLEDGE_BASE_CREATE_UPDATE => 'База знаний: добавление и редактирование',
            self::KNOWLEDGE_BASE_DELETE => 'База знаний: удаление',
            self::SETTINGS_VIEW => 'Просмотр настроек',
            self::SETTINGS_MANAGE => 'Управление настройками',
            self::ROLES_VIEW => 'Просмотр ролей и прав',
            self::ROLES_MANAGE => 'Управление ролями и правами',
        };
    }

    /**
     * Permissions currently exposed in UI.
     */
    public static function uiCases(): array
    {
        return self::cases();
    }

    public static function uiValues(): array
    {
        return array_map(
            static fn (self $permission): string => $permission->value,
            self::uiCases(),
        );
    }

    public static function values(): array
    {
        return array_map(
            static fn (self $permission): string => $permission->value,
            self::cases(),
        );
    }
}
