SET NAMES utf8mb4;

-- Repeatable, append-only settlement journal for studio-session overages.
-- Quantities are authoritative integer minutes; package hour snapshots are
-- derived from those minutes by the application inside one transaction.
CREATE TABLE IF NOT EXISTS session_settlements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  booking_session_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  original_client_package_id BIGINT UNSIGNED NULL,
  actual_minutes INT UNSIGNED NOT NULL,
  covered_minutes INT UNSIGNED NOT NULL,
  excess_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  billable_minutes INT UNSIGNED NOT NULL,
  waived_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  settlement_mode VARCHAR(32) NOT NULL,
  amount_due DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  internal_reason VARCHAR(500) NULL,
  client_note VARCHAR(500) NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  preview_hash CHAR(64) NOT NULL,
  session_version INT UNSIGNED NOT NULL,
  response_json JSON NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_settlement_session (booking_session_id),
  UNIQUE KEY uq_session_settlement_idempotency (organization_id,idempotency_key),
  KEY idx_session_settlement_booking (organization_id,booking_id),
  KEY idx_session_settlement_client (organization_id,client_id,created_at),
  CONSTRAINT fk_session_settlement_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_settlement_session FOREIGN KEY (booking_session_id) REFERENCES booking_sessions(id) ON DELETE RESTRICT,
  CONSTRAINT fk_session_settlement_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_session_settlement_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
  CONSTRAINT fk_session_settlement_original_package FOREIGN KEY (original_client_package_id) REFERENCES client_packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_settlement_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS session_settlement_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  settlement_id BIGINT UNSIGNED NOT NULL,
  allocation_type VARCHAR(32) NOT NULL,
  minutes INT UNSIGNED NOT NULL DEFAULT 0,
  source_client_package_id BIGINT UNSIGNED NULL,
  target_client_package_id BIGINT UNSIGNED NULL,
  service_id BIGINT UNSIGNED NULL,
  project_id BIGINT UNSIGNED NULL,
  invoice_id BIGINT UNSIGNED NULL,
  payment_id BIGINT UNSIGNED NULL,
  rate_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(24) NOT NULL DEFAULT 'minute',
  amount_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0,
  internal_note VARCHAR(500) NULL,
  client_note VARCHAR(500) NULL,
  event_key VARCHAR(190) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_session_settlement_allocation_event (settlement_id,event_key),
  KEY idx_session_allocation_source_package (source_client_package_id,created_at),
  KEY idx_session_allocation_target_package (target_client_package_id,created_at),
  KEY idx_session_allocation_invoice (invoice_id),
  KEY idx_session_allocation_project (project_id),
  CONSTRAINT fk_session_allocation_settlement FOREIGN KEY (settlement_id) REFERENCES session_settlements(id) ON DELETE CASCADE,
  CONSTRAINT fk_session_allocation_source_package FOREIGN KEY (source_client_package_id) REFERENCES client_packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_allocation_target_package FOREIGN KEY (target_client_package_id) REFERENCES client_packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_allocation_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_allocation_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_allocation_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_session_allocation_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS mta_add_column;
DELIMITER $$
CREATE PROCEDURE mta_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @mta_sql=CONCAT('ALTER TABLE `',p_table,'` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE mta_stmt FROM @mta_sql; EXECUTE mta_stmt; DEALLOCATE PREPARE mta_stmt;
  END IF;
END$$
DELIMITER ;

CALL mta_add_column('booking_sessions','settlement_version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `adjustment_reason`');
CALL mta_add_column('client_packages','purchased_minutes','INT UNSIGNED NULL AFTER `purchased_quantity`');
CALL mta_add_column('client_packages','held_minutes','INT UNSIGNED NULL AFTER `held_quantity`');
CALL mta_add_column('client_packages','consumed_minutes','INT UNSIGNED NULL AFTER `consumed_quantity`');
CALL mta_add_column('client_packages','payment_due_minutes','INT UNSIGNED NULL AFTER `payment_due_quantity`');
CALL mta_add_column('package_usage_ledger','quantity_minutes','INT NULL AFTER `quantity`');

-- One-time conversion of legacy hour snapshots. From this migration onward,
-- settlement mutations update the integer columns first and derive DECIMAL
-- hours from their cumulative values, never from rounded per-event hours.
UPDATE client_packages
SET purchased_minutes=ROUND(GREATEST(0,purchased_quantity)*60),
    held_minutes=ROUND(GREATEST(0,held_quantity)*60),
    consumed_minutes=ROUND(GREATEST(0,consumed_quantity)*60),
    payment_due_minutes=ROUND(GREATEST(0,payment_due_quantity)*60)
WHERE billing_unit='hour'
  AND (purchased_minutes IS NULL OR held_minutes IS NULL OR consumed_minutes IS NULL OR payment_due_minutes IS NULL);

UPDATE package_usage_ledger ledger
JOIN client_packages package_row ON package_row.id=ledger.client_package_id
SET ledger.quantity_minutes=ROUND(ledger.quantity*60)
WHERE package_row.billing_unit='hour' AND ledger.quantity_minutes IS NULL;
DROP PROCEDURE IF EXISTS mta_add_column;
