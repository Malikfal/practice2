<?php

namespace App\Enums;

enum ManagerReportGranularity: string
{
    case WEEK = 'week';
    case MONTH = 'month';
    case QUARTER = 'quarter';
    case YEAR = 'year';
}
