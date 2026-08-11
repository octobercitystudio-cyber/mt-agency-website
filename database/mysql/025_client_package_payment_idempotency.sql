SET NAMES utf8mb4;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS note VARCHAR(500) NULL AFTER reference;

CREATE TABLE IF NOT EXISTS client_package_payment_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status ENUM('processing','completed') NOT NULL DEFAULT 'processing',
  response_json JSON NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_package_payment_request (organization_id,idempotency_key),
  KEY idx_client_package_payment_package (client_package_id,created_at),
  CONSTRAINT fk_client_package_payment_request_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_client_package_payment_request_package FOREIGN KEY (client_package_id) REFERENCES client_packages(id) ON DELETE RESTRICT,
  CONSTRAINT fk_client_package_payment_request_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
