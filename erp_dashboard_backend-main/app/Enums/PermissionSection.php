<?php

namespace App\Enums;

enum PermissionSection: string
{
    case PROJECTS = 'projects';
    case PROJECTS_BUDGET = 'projects.budget';
    case PROJECT_MEMBERS = 'project.members';
    case PROJECT_ASSIGNMENT_HISTORIES = 'project.assignment_histories';
    case PROJECT_ACTIVITY_HISTORIES = 'project.activity_histories';
    case PROJECTS_TABS_ABOUT = 'projects.tabs.about';
    case PROJECTS_TABS_TASKS = 'projects.tabs.tasks';
    case PROJECTS_TABS_TASKS_COMMENTS = 'projects.tabs.tasks.comments';
    case PROJECTS_TABS_TASKS_ATTACHMENTS = 'projects.tabs.tasks.attachments';
    case PROJECTS_TABS_DOCUMENTS = 'projects.tabs.documents';
    case PROJECTS_TABS_NOTES = 'projects.tabs.notes';
    case PROJECTS_TABS_REPORTS = 'projects.tabs.reports';
    case PROJECTS_TABS_FINANCE = 'projects.tabs.finance';
    case PROJECTS_DOCUMENTS = 'projects.documents';
    case PROJECTS_NOTES = 'projects.notes';
    case TASKS = 'tasks';
    case TASKS_STATUS = 'tasks.status';
    case EMPLOYEES = 'employees';
    case EMPLOYEES_TABS_DOCUMENTS = 'employees.tabs.documents';
    case EMPLOYEES_TABS_DAY = 'employees.tabs.day';
    case EMPLOYEES_TABS_GENERAL = 'employees.tabs.general';
    case EMPLOYEES_TABS_SETTINGS = 'employees.tabs.settings';
    case EMPLOYEES_TABS_SALARY = 'employees.tabs.salary';
    case EMPLOYEES_TABS_CALCULATIONS = 'employees.tabs.calculations';
    case REPORTS = 'reports';
    case TIME = 'time';
    case ROLES = 'roles';
    case CLIENTS = 'clients';
    case KNOWLEDGE_BASE = 'knowledge_base';
    case FINANCE = 'finance';
    case SETTINGS = 'settings';
}
