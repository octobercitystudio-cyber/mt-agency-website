SET NAMES utf8mb4;

-- Forward-only migration. Run once after 014_package_details_accuracy.sql.
-- Owner corrections are append-only and all monetary deltas use exact DECIMAL cents.

ALTER TABLE payments
  ADD COLUMN void_reason VARCHAR(500) NULL AFTER status,
  ADD COLUMN voided_by BIGINT UNSIGNED NULL AFTER void_reason,
  ADD COLUMN voided_at DATETIME NULL AFTER voided_by,
  ADD COLUMN corrected_from_id BIGINT UNSIGNED NULL AFTER voided_at,
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER corrected_from_id,
  ADD KEY idx_payments_void_state (organization_id, voided_at, created_at),
  ADD CONSTRAINT fk_payments_voided_by FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_payments_corrected_from FOREIGN KEY (corrected_from_id) REFERENCES payments(id) ON DELETE SET NULL;

ALTER TABLE payment_proofs
  ADD COLUMN void_reason VARCHAR(500) NULL AFTER status,
  ADD COLUMN voided_by BIGINT UNSIGNED NULL AFTER void_reason,
  ADD COLUMN voided_at DATETIME NULL AFTER voided_by,
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER voided_at,
  ADD KEY idx_payment_proofs_void_state (organization_id, voided_at, created_at),
  ADD CONSTRAINT fk_payment_proofs_voided_by FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE finance
  ADD COLUMN reversal_reason VARCHAR(500) NULL AFTER reversed_entry_id,
  ADD COLUMN corrected_from_id BIGINT UNSIGNED NULL AFTER reversal_reason,
  ADD COLUMN voided_by BIGINT UNSIGNED NULL AFTER corrected_from_id,
  ADD COLUMN voided_at DATETIME NULL AFTER voided_by,
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER voided_at,
  ADD UNIQUE KEY uq_finance_reversal_once (organization_id, reversed_entry_id),
  ADD KEY idx_finance_void_state (organization_id, voided_at, date),
  ADD CONSTRAINT fk_finance_corrected_from FOREIGN KEY (corrected_from_id) REFERENCES finance(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_finance_voided_by FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE client_packages
  ADD COLUMN notes TEXT NULL AFTER name,
  ADD COLUMN archive_reason VARCHAR(500) NULL AFTER status,
  ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archive_reason,
  ADD COLUMN archived_at DATETIME NULL AFTER archived_by,
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER archived_at,
  ADD KEY idx_packages_archive_state (organization_id, archived_at, status),
  ADD CONSTRAINT fk_packages_archived_by FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE services
  ADD COLUMN is_draft TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active,
  ADD COLUMN archive_reason VARCHAR(500) NULL AFTER is_draft,
  ADD COLUMN archived_by BIGINT UNSIGNED NULL AFTER archive_reason,
  ADD COLUMN archived_at DATETIME NULL AFTER archived_by,
  ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 1 AFTER archived_at,
  ADD KEY idx_services_archive_state (organization_id, archived_at, is_active),
  ADD CONSTRAINT fk_services_archived_by FOREIGN KEY (archived_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE package_usage_ledger
  ADD COLUMN reverses_ledger_id BIGINT UNSIGNED NULL AFTER event_key,
  ADD UNIQUE KEY uq_usage_reversal_once (reverses_ledger_id),
  ADD CONSTRAINT fk_usage_reverses FOREIGN KEY (reverses_ledger_id) REFERENCES package_usage_ledger(id) ON DELETE SET NULL;

CREATE TABLE owner_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  adjustment_type VARCHAR(80) NOT NULL,
  amount_delta_cents BIGINT NOT NULL DEFAULT 0,
  quantity_delta DECIMAL(12,4) NOT NULL DEFAULT 0,
  reason VARCHAR(500) NOT NULL,
  before_data JSON NOT NULL,
  after_data JSON NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_owner_adjustments_entity (organization_id, entity_type, entity_id, created_at),
  CONSTRAINT fk_owner_adjustments_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_owner_adjustments_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
