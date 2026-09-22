CREATE TABLE IF NOT EXISTS registration_bot_challenges (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 challenge_hash CHAR(64) NOT NULL,
 signing_secret CHAR(64) NOT NULL,
 browser_hash CHAR(64) NOT NULL,
 expires_at BIGINT UNSIGNED NOT NULL,
 consumed_at DATETIME NULL,
 user_id BIGINT UNSIGNED NULL,
 request_hash CHAR(64) NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_registration_bot_challenge (challenge_hash),
 KEY idx_registration_bot_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;