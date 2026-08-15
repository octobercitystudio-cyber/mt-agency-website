-- Forward-only safety additions. Existing booking rows are never rewritten.
CREATE TABLE IF NOT EXISTS booking_archives (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NULL,
  snapshot_json JSON NOT NULL,
  archived_by BIGINT UNSIGNED NOT NULL,
  archived_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_booking_archive_once (organization_id, booking_id),
  KEY idx_booking_archive_client (organization_id, client_id, archived_at),
  KEY idx_booking_archive_package (organization_id, client_package_id, archived_at),
  CONSTRAINT fk_booking_archive_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_booking_archive_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_booking_archive_package FOREIGN KEY (client_package_id) REFERENCES client_packages(id),
  CONSTRAINT fk_booking_archive_user FOREIGN KEY (archived_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The archive deliberately has no FK to bookings: the operational row may be
-- removed after its complete immutable snapshot is stored.
