<?php

return [
    'disk' => env('IMPORT_DISK', 'local'),
    'queue_connection' => env('IMPORT_QUEUE_CONNECTION', 'database_import'),
    'queue' => env('IMPORT_QUEUE', App\Support\QueueNames::IMPORT),
    'max_file_size_kb' => (int) env('IMPORT_MAX_FILE_SIZE_KB', 20480),
    'progress_update_every' => (int) env('IMPORT_PROGRESS_UPDATE_EVERY', 25),
];
