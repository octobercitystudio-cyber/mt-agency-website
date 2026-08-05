SET NAMES utf8mb4;

-- Forward-only migration. Import once after 011_flexible_service_projects.sql.
-- Formation capital is intentionally isolated from the operating finance ledger.

CREATE TABLE formation_founders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  founder_key VARCHAR(32) NOT NULL,
  name_ar VARCHAR(120) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_formation_founder_key (organization_id, founder_key),
  KEY idx_formation_founders_active (organization_id, is_active, sort_order),
  CONSTRAINT fk_formation_founders_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formation_fund_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  entry_type VARCHAR(24) NOT NULL,
  founder_id BIGINT UNSIGNED NULL,
  amount DECIMAL(14,2) NOT NULL,
  title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NULL,
  payment_method VARCHAR(80) NULL,
  reference VARCHAR(120) NULL,
  entry_date DATE NOT NULL,
  note TEXT NULL,
  allocation_mode VARCHAR(24) NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  void_reason VARCHAR(500) NULL,
  voided_by BIGINT UNSIGNED NULL,
  voided_at DATETIME NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_formation_entries_org_date (organization_id, status, entry_date, id),
  KEY idx_formation_entries_founder (organization_id, founder_id, status),
  CONSTRAINT fk_formation_entries_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_formation_entries_founder FOREIGN KEY (founder_id) REFERENCES formation_founders(id),
  CONSTRAINT fk_formation_entries_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_formation_entries_voider FOREIGN KEY (voided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_formation_entry_type CHECK (entry_type IN ('contribution','expense')),
  CONSTRAINT chk_formation_entry_status CHECK (status IN ('active','voided')),
  CONSTRAINT chk_formation_entry_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formation_expense_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  expense_entry_id BIGINT UNSIGNED NOT NULL,
  founder_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_formation_expense_founder (expense_entry_id, founder_id),
  KEY idx_formation_allocations_founder (organization_id, founder_id, expense_entry_id),
  CONSTRAINT fk_formation_allocations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_formation_allocations_entry FOREIGN KEY (expense_entry_id) REFERENCES formation_fund_entries(id),
  CONSTRAINT fk_formation_allocations_founder FOREIGN KEY (founder_id) REFERENCES formation_founders(id),
  CONSTRAINT chk_formation_allocation_amount CHECK (amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO formation_founders (organization_id, founder_key, name_ar, sort_order)
SELECT o.id, seed.founder_key, seed.name_ar, seed.sort_order
FROM organizations o
JOIN (
  SELECT 'ashraf' AS founder_key, 'أشرف' AS name_ar, 1 AS sort_order
  UNION ALL SELECT 'marwa', 'مروة', 2
  UNION ALL SELECT 'mohamed', 'محمد', 3
) seed
LEFT JOIN formation_founders existing
  ON existing.organization_id=o.id AND existing.founder_key=seed.founder_key
WHERE existing.id IS NULL;
