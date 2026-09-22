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
        // Short-lived pickup availability JSON. This directory must already
        // exist, be writable by PHP, and remain outside public_html.
        'private_runtime_dir' => dirname(__DIR__, 2) . '/private_runtime/pickup-availability',
        'max_upload_bytes' => 5 * 1024 * 1024,
    ],
    // Google Identity Services web OAuth client ID (public identifier, no client secret).
    'google_auth' => [
        'enabled' => false,
        'client_id' => getenv('MT_GOOGLE_CLIENT_ID') ?: '',
        'certificate_cache_dir' => dirname(__DIR__, 2) . '/private_runtime/google-auth',
    ],
    'registration' => ['organization_id' => 1],
    // SMTP account used only for customer email-verification codes.
    // Keep passwords in server-only config.php or in the named environment variable.
    'registration_mail' => [
        'enabled' => false,
        'host' => 'smtp.hostinger.com',
        'port' => 465,
        'encryption' => 'ssl',
        'username' => 'your-company-mailbox@example.com',
        'password_env' => 'MT_REGISTRATION_SMTP_PASSWORD',
        'from_address' => 'your-company-mailbox@example.com',
        'from_name' => 'Multi Task Agency',
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
    'push' => [
        'enabled' => false,
        // Public Firebase Web App identifiers. They are safe to expose to the browser.
        'firebase' => [
            'api_key' => 'replace-with-firebase-web-api-key',
            'auth_domain' => 'your-project.firebaseapp.com',
            'project_id' => 'your-project-id',
            'storage_bucket' => 'your-project.firebasestorage.app',
            'messaging_sender_id' => 'replace-with-sender-id',
            'app_id' => 'replace-with-web-app-id',
            'vapid_public_key' => 'replace-with-web-push-vapid-public-key',
        ],
        // Keep the service-account JSON outside public_html.
        'service_account_file' => dirname(__DIR__, 2) . '/private_config/firebase-service-account.json',
        'worker_key' => 'replace-with-a-long-random-push-worker-key',
    ],
];
