<?php

namespace App\Enums;

enum DataImportStatus: string
{
    case QUEUED = 'QUEUED';
    case PARSING = 'PARSING';
    case IMPORTING = 'IMPORTING';
    case COMPLETED = 'COMPLETED';
    case COMPLETED_WITH_ERRORS = 'COMPLETED_WITH_ERRORS';
    case FAILED = 'FAILED';
    case CANCELLED = 'CANCELLED';

    public function isFinished(): bool
    {
        return in_array($this, [self::COMPLETED, self::COMPLETED_WITH_ERRORS, self::FAILED, self::CANCELLED], true);
    }
}
