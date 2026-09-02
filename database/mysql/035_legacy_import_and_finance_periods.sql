SET NAMES utf8mb4;

-- Audit-safe, idempotent imports from the retired desktop database. The source
-- rows are kept as an immutable business archive; user/password tables are
-- deliberately never accepted by the application importer.
CREATE TABLE IF NOT EXISTS legacy_import_batches (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status ENUM('processing','completed') NOT NULL DEFAULT 'processing',
  response_json JSON NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  UNIQUE KEY uq_legacy_import_source (organization_id,source_sha256),
  UNIQUE KEY uq_legacy_import_key (organization_id,idempotency_key),
  KEY idx_legacy_import_created (organization_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS legacy_import_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  batch_id BIGINT UNSIGNED NOT NULL,
  source_table VARCHAR(64) NOT NULL,
  source_row_key VARCHAR(120) NOT NULL,
  payload_json JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_legacy_import_record (batch_id,source_table,source_row_key),
  KEY idx_legacy_record_org (organization_id,source_table)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Each calendar month has its own close/reopen state and close snapshot.
-- Wallet reports start from zero on day 1 while prior-month movements remain
-- preserved and available by selecting their month.
CREATE TABLE IF NOT EXISTS finance_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  period_month CHAR(7) NOT NULL,
  status ENUM('open','closed') NOT NULL DEFAULT 'open',
  opening_balances_json JSON NULL,
  closing_balances_json JSON NULL,
  income_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  expense_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  net_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  closed_at DATETIME NULL,
  closed_by BIGINT UNSIGNED NULL,
  reopened_at DATETIME NULL,
  reopened_by BIGINT UNSIGNED NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_period (organization_id,period_month),
  KEY idx_finance_period_status (organization_id,status,period_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
