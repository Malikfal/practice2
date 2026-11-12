<?php

namespace App\Enums;

enum DataImportRowStatus: string
{
    case CREATED = 'CREATED';
    case SKIPPED = 'SKIPPED';
    case FAILED = 'FAILED';
}
