<?php

use App\Support\QueueNames;

return [
    'timezone' => env('PAYROLL_TIMEZONE', 'Europe/Moscow'),

    'recalculation_queue_connection' => env(
        'PAYROLL_RECALCULATION_QUEUE_CONNECTION',
        'database_payroll_recalculation',
    ),
    'recalculation_queue' => env(
        'PAYROLL_RECALCULATION_QUEUE',
        QueueNames::PAYROLL_RECALCULATION,
    ),
];
