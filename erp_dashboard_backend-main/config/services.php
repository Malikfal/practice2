<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'external_api' => [
        'token' => env('EXTERNAL_API_TOKEN'),
        'company_id' => env('EXTERNAL_API_COMPANY_ID'),
    ],

    'telegram' => [
        'bot_token' => env('TELEGRAM_BOT_TOKEN'),
        'chat_id' => env('TELEGRAM_CHAT_ID'),
    ],

    // Statistics of Flow hours sent to Telegram by reports:send-flow-stats.
    'flow_stats' => [
        // The schedule is registered only when enabled.
        'enabled' => (bool) env('FLOW_STATS_ENABLED', false),
        'bot_token' => env('FLOW_STATS_BOT_TOKEN'),
        // Comma-separated chat IDs.
        'chat_ids' => env('FLOW_STATS_CHAT_IDS'),
        // Optional proxy for api.telegram.org, e.g. socks5h://host:port: it is blocked from Russian servers.
        'proxy' => env('FLOW_STATS_PROXY'),
        'company_id' => env('FLOW_STATS_COMPANY_ID'),
        // Comma-separated emails of users whose time is left out, e.g. test accounts.
        'excluded_emails' => env('FLOW_STATS_EXCLUDED_EMAILS'),
        // Days without data in the database, YYYY-MM-DD inclusive. Clear both once the data is restored.
        'data_gap_from' => env('FLOW_STATS_DATA_GAP_FROM'),
        'data_gap_to' => env('FLOW_STATS_DATA_GAP_TO'),
    ],

    'smartcaptcha' => [
        'secret' => env('SMARTCAPTCHA_SERVER_KEY'),
    ],

];
