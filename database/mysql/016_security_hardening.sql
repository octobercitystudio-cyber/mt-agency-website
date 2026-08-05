-- Authentication throttling and security audit trail.
-- This migration stores hashes only; login identifiers and IP addresses are never saved in plain text.

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  limit_key CHAR(64) NOT NULL,
  scope VARCHAR(24) NOT NULL,
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  blocked_until DATETIME NULL,
  last_attempt_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_rate_limit_key (limit_key),
  KEY idx_auth_rate_limits_blocked (blocked_until),
  KEY idx_auth_rate_limits_last_attempt (last_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_security_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  event_type VARCHAR(48) NOT NULL,
  identifier_hash CHAR(64) NULL,
  ip_hash CHAR(64) NOT NULL,
  user_agent_hash CHAR(64) NULL,
  details JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_auth_events_created (created_at),
  KEY idx_auth_events_user (user_id, created_at),
  KEY idx_auth_events_ip (ip_hash, created_at),
  CONSTRAINT fk_auth_events_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  CONSTRAINT fk_auth_events_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Keep the tables bounded without requiring a separate maintenance job.
DELETE FROM auth_rate_limits WHERE last_attempt_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
DELETE FROM auth_security_events WHERE created_at < DATE_SUB(NOW(), INTERVAL 400 DAY);
