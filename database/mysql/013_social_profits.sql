SET NAMES utf8mb4;

-- Forward-only migration. Import once after 012_formation_fund.sql.
-- Social platform revenue is isolated from operating finance and formation capital.

CREATE TABLE social_profit_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  platform VARCHAR(24) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  receipt_date DATE NOT NULL,
  earning_year SMALLINT UNSIGNED NOT NULL,
  earning_month TINYINT UNSIGNED NOT NULL,
  channel_name VARCHAR(180) NOT NULL,
  payout_reference VARCHAR(140) NULL,
  note TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  void_reason VARCHAR(500) NULL,
  voided_by BIGINT UNSIGNED NULL,
  voided_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_social_profit_report (organization_id, earning_year, status, platform, earning_month),
  KEY idx_social_profit_receipt (organization_id, receipt_date, id),
  KEY idx_social_profit_reference (organization_id, payout_reference),
  CONSTRAINT fk_social_profit_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_social_profit_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_social_profit_voider FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_social_profit_platform CHECK (platform IN ('youtube','facebook')),
  CONSTRAINT chk_social_profit_status CHECK (status IN ('active','voided')),
  CONSTRAINT chk_social_profit_amount CHECK (amount >= 0.01),
  CONSTRAINT chk_social_profit_month CHECK (earning_month BETWEEN 1 AND 12)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
