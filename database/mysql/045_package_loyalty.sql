CREATE TABLE IF NOT EXISTS package_loyalty (
  organization_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 0,
  last_paid_cents BIGINT NOT NULL DEFAULT 0,
  eligible_paid_cents BIGINT NOT NULL DEFAULT 0,
  allocation_snapshot LONGTEXT NULL,
  awarded_points BIGINT NOT NULL DEFAULT 0,
  spent_cents BIGINT NOT NULL,
  earned_rate DECIMAL(12,4) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, client_package_id),
  KEY idx_loyalty_client (organization_id,client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_loyalty_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  paid_cents BIGINT NOT NULL,
  eligible_paid_cents BIGINT NOT NULL,
  points_delta BIGINT NOT NULL,
  enabled TINYINT(1) NOT NULL,
  reason VARCHAR(120) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_loyalty_package (organization_id,client_package_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
