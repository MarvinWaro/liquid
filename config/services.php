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

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', env('REDIRECT_URI')),
    ],

    'turnstile' => [
        'enabled' => env('TURNSTILE_ENABLED', env('TURNSTILE_SITE_KEY') && env('TURNSTILE_SECRET_KEY')),
        'site_key' => env('TURNSTILE_SITE_KEY'),
        'secret_key' => env('TURNSTILE_SECRET_KEY'),
        'verify_url' => env('TURNSTILE_VERIFY_URL', 'https://challenges.cloudflare.com/turnstile/v0/siteverify'),
    ],

    // OpenAI provider config now lives in config/ai.php (laravel/ai SDK).
    // The SDK reads OPENAI_API_KEY and OPENAI_URL automatically.
    // App-specific overrides for the Report Assistant feature only:
    'report_assistant' => [
        'model' => env('OPENAI_REPORT_ASSISTANT_MODEL', 'gpt-5-nano'),
        'timeout' => (int) env('OPENAI_TIMEOUT', 45),
    ],

    'mcp' => [
        'api_key' => env('MCP_API_KEY'),
        'user_email' => env('MCP_USER_EMAIL'),
    ],

];
