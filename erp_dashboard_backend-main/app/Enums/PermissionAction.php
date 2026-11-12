<?php

namespace App\Enums;

enum PermissionAction: string
{
    case VIEW = 'view';
    case VIEW_ALL = 'view_all';
    case VIEW_ASSIGNED = 'view_assigned';
    case VIEW_PROJECT_ASSIGNED = 'view_project_assigned';
    case VIEW_LIST = 'view_list';
    case UPDATE = 'update';
    case CREATE_UPDATE = 'create_update';
    case DELETE = 'delete';
    case ASSIGN = 'assign';
    case MANAGE = 'manage';
    case MOVE = 'move';
    case TASKS_VIEW = 'tasks.view';
    case MANAGERS_VIEW = 'managers.view';
    case OVERRUN_VIEW = 'overrun.view';
    case STALE_TASKS_VIEW = 'stale_tasks.view';
    case LIMITS_VIEW = 'limits.view';
    case HOURS_CHART_VIEW = 'hours_chart.view';
    case DELETE_SELF = 'delete_self';
    case DELETE_OTHERS = 'delete_others';
    case DELETE_ALL = 'delete_all';
    case ADD_FOR_PROJECT_USERS = 'add_for_project_users';
    case ADD_FOR_OTHERS = 'add_for_others';
    case ADD_FOR_ALL = 'add_for_all';
    case PASSWORD_RESET = 'password.reset';
}
