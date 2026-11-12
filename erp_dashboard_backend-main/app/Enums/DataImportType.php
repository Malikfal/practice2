<?php

namespace App\Enums;

enum DataImportType: string
{
    case FINANCES = 'FINANCES';
    case PROJECTS = 'PROJECTS';
    case EMPLOYEES = 'EMPLOYEES';
    case EMPLOYEE_PAYROLL = 'EMPLOYEE_PAYROLL';
}
