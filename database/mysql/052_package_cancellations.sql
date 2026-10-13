CREATE TABLE IF NOT EXISTS package_cancellations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  refund_cents BIGINT UNSIGNED NOT NULL,
  finance_id BIGINT UNSIGNED NULL,
  snapshot_json LONGTEXT NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_package_cancellation (organization_id, client_package_id),
  KEY idx_cancellation_finance (organization_id, finance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
