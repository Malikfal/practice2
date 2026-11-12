<?php

namespace App\Enums;

enum PayrollRecalculationStatus: string
{
    case QUEUED = 'QUEUED';
    case RUNNING = 'RUNNING';
    case COMPLETED = 'COMPLETED';
    case FAILED = 'FAILED';

    public function isActive(): bool
    {
        return in_array($this, [self::QUEUED, self::RUNNING], true);
    }
}
