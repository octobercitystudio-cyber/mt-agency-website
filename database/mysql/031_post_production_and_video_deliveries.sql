SET NAMES utf8mb4;

-- Post-production is an append-only operational layer over completed studio
-- sessions. It never rewrites the booking, settlement, package or finance data.
CREATE TABLE IF NOT EXISTS post_production_jobs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  booking_session_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  status ENUM('editing_in_progress','editing_completed','uploading','upload_completed','ready_for_pickup','delivered') NOT NULL DEFAULT 'editing_in_progress',
  version INT UNSIGNED NOT NULL DEFAULT 1,
  status_changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  needs_review TINYINT(1) NOT NULL DEFAULT 0,
  is_client_visible TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_post_production_session (booking_session_id),
  UNIQUE KEY uq_post_production_booking (booking_id),
  KEY idx_post_production_org_status (organization_id, status, status_changed_at),
  KEY idx_post_production_client (organization_id, client_id, is_client_visible, created_at),
  CONSTRAINT fk_post_production_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_post_production_session FOREIGN KEY (booking_session_id) REFERENCES booking_sessions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_production_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_production_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_post_production_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_post_production_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS post_production_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  post_production_job_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  version INT UNSIGNED NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_post_production_history_version (post_production_job_id, version),
  KEY idx_post_production_history_org (organization_id, post_production_job_id, changed_at),
  CONSTRAINT fk_post_production_history_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_post_production_history_job FOREIGN KEY (post_production_job_id) REFERENCES post_production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_post_production_history_user FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS video_delivery_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  post_production_job_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  link_kind ENUM('folder','video') NOT NULL DEFAULT 'folder',
  url VARCHAR(2048) NOT NULL,
  url_hash CHAR(64) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_video_delivery_job_url (post_production_job_id, url_hash),
  KEY idx_video_delivery_active (organization_id, post_production_job_id, is_active, sort_order),
  CONSTRAINT fk_video_delivery_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_video_delivery_job FOREIGN KEY (post_production_job_id) REFERENCES post_production_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_video_delivery_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_video_delivery_updater FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historical sessions are deliberately private and flagged for owner review.
-- This avoids presenting old delivered work as newly entered editing work.
INSERT IGNORE INTO post_production_jobs (
  organization_id, booking_session_id, booking_id, client_id, status,
  version, status_changed_at, needs_review, is_client_visible, created_by, updated_by
)
SELECT bs.organization_id, bs.id, bs.booking_id, bs.client_id, 'editing_in_progress',
       1, COALESCE(bs.ended_at, bs.updated_at), 1, 0, bs.ended_by, bs.ended_by
FROM booking_sessions bs
JOIN bookings b ON b.id = bs.booking_id AND b.organization_id = bs.organization_id
WHERE bs.status = 'completed';

INSERT IGNORE INTO post_production_status_history (
  organization_id, post_production_job_id, from_status, to_status, version, changed_by, changed_at
)
SELECT j.organization_id, j.id, NULL, j.status, 1, j.created_by, j.status_changed_at
FROM post_production_jobs j
WHERE j.needs_review = 1;
