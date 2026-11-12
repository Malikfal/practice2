<?php

namespace App\Enums;

/** Размер календарного интервала в гистограмме финансовой аналитики. */
enum FinanceAnalyticsGranularity: string
{
    case DAY = 'day';
    case WEEK = 'week';
    case MONTH = 'month';
    case QUARTER = 'quarter';
}
