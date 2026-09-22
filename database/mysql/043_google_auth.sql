CREATE TABLE IF NOT EXISTS auth_google_identities (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 user_id BIGINT UNSIGNED NOT NULL,
 google_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_google_subject (google_sub),
 UNIQUE KEY uq_google_user (user_id),
 KEY idx_google_org (organization_id),
 CONSTRAINT fk_google_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
 CONSTRAINT fk_google_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_google_challenges (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 challenge_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 nonce_hash CHAR(64) NOT NULL,
 browser_hash CHAR(64) NOT NULL,
 expires_at DATETIME NOT NULL,
 consumed_at DATETIME NULL,
 google_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
 link_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 link_expires_at DATETIME NULL,
 linked_at DATETIME NULL,
 created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_google_challenge (challenge_hash),
 UNIQUE KEY uq_google_link (link_hash),
 KEY idx_google_challenge_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;