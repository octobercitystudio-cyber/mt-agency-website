-- Remember devices independently of short-lived, idle-limited API sessions.
-- Only hashes are stored. Password changes and account revocation invalidate
-- every remembered device through users.credential_version / users.is_active.
CREATE TABLE IF NOT EXISTS remembered_login_devices (
  token_hash CHAR(64) PRIMARY KEY,
  device_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  credential_version INT NOT NULL,
  user_agent_hash CHAR(64) NOT NULL,
  generation INT UNSIGNED NOT NULL DEFAULT 0,
  session_token_hash CHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_remembered_login_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
