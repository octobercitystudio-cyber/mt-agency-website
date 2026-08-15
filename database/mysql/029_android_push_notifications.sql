-- Native-style push delivery for the Android Trusted Web Activity.
-- Forward-only: existing application notifications and customer data are not modified.

CREATE TABLE IF NOT EXISTS app_push_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NULL,
  token_hash CHAR(64) NOT NULL,
  token TEXT NOT NULL,
  platform VARCHAR(24) NOT NULL DEFAULT 'web-android',
  device_label VARCHAR(120) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_push_token_hash (token_hash),
  KEY idx_app_push_user (organization_id, user_id, is_active),
  KEY idx_app_push_client (organization_id, client_id, is_active),
  CONSTRAINT fk_app_push_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_app_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_push_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT chk_app_push_principal CHECK ((user_id IS NOT NULL AND client_id IS NULL) OR (user_id IS NULL AND client_id IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_push_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  notification_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  last_error VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_push_notification (notification_id),
  KEY idx_app_push_worker (status, available_at, id),
  CONSTRAINT fk_app_push_jobs_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_app_push_jobs_notification FOREIGN KEY (notification_id) REFERENCES app_notifications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
