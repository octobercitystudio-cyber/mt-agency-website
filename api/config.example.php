<?php
declare(strict_types=1);

return [
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'hostinger_database_name',
        'user' => 'hostinger_database_user',
        'password' => 'replace-with-a-strong-password',
        'charset' => 'utf8mb4',
    ],
    'app' => [
        'environment' => 'production',
        'allowed_origin' => 'https://your-domain.example',
        'setup_key' => 'replace-with-a-long-random-setup-key',
        'session_days' => 7,
        'session_idle_minutes' => 120,
        'max_sessions_per_user' => 5,
        // Keep customer documents outside public_html.
        'upload_dir' => dirname(__DIR__, 2) . '/private_uploads/payment-proofs',
        'max_upload_bytes' => 5 * 1024 * 1024,
    ],
    'whatsapp' => [
        'enabled' => false,
        // Keep this configurable so upgrades do not require application-code changes.
        'graph_version' => 'v23.0',
        'phone_number_id' => 'replace-with-meta-phone-number-id',
        'access_token' => 'replace-with-a-permanent-system-user-token',
        'template_name' => 'package_financial_summary',
        'template_language' => 'ar',
        'expiry_reminder_days' => [7, 1, 0],
        'worker_key' => 'replace-with-a-long-random-cron-worker-key',
    ],
];
