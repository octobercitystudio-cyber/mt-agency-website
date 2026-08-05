SET NAMES utf8mb4;

-- One-time, non-destructive migration. Package thresholds are snapshots so
-- later service edits do not change an existing client agreement.
ALTER TABLE client_packages
  ADD COLUMN payment_due_quantity DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER consumed_quantity,
  ADD COLUMN source_invoice_id BIGINT UNSIGNED NULL AFTER service_id,
  ADD KEY idx_packages_source_invoice (source_invoice_id),
  ADD CONSTRAINT fk_packages_source_invoice FOREIGN KEY (source_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

UPDATE client_packages cp
JOIN services s ON s.id = cp.service_id AND s.organization_id = cp.organization_id
SET cp.payment_due_quantity = s.payment_due_hours
WHERE cp.billing_unit = 'hour'
  AND cp.payment_due_quantity = 0
  AND s.payment_due_hours > 0;

ALTER TABLE payment_proofs
  ADD COLUMN organization_id BIGINT UNSIGNED NULL AFTER id,
  ADD COLUMN client_package_id BIGINT UNSIGNED NULL AFTER client_id,
  ADD COLUMN invoice_id BIGINT UNSIGNED NULL AFTER client_package_id;

UPDATE payment_proofs pp
JOIN clients c ON c.id = pp.client_id
SET pp.organization_id = c.organization_id
WHERE pp.organization_id IS NULL;

ALTER TABLE payment_proofs
  MODIFY organization_id BIGINT UNSIGNED NOT NULL,
  ADD KEY idx_proofs_org_status (organization_id, status, created_at),
  ADD KEY idx_proofs_package (client_package_id),
  ADD KEY idx_proofs_invoice (invoice_id),
  ADD CONSTRAINT fk_proofs_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  ADD CONSTRAINT fk_proofs_package FOREIGN KEY (client_package_id) REFERENCES client_packages(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_proofs_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS payment_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  payment_id BIGINT UNSIGNED NOT NULL,
  payment_proof_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NULL,
  invoice_id BIGINT UNSIGNED NULL,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_payment_allocations_proof (payment_proof_id),
  KEY idx_payment_allocations_payment (payment_id),
  KEY idx_payment_allocations_client (organization_id, client_id, created_at),
  KEY idx_payment_allocations_package (client_package_id),
  KEY idx_payment_allocations_invoice (invoice_id),
  CONSTRAINT fk_payment_allocations_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_payment_allocations_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_payment_allocations_payment FOREIGN KEY (payment_id) REFERENCES payments(id),
  CONSTRAINT fk_payment_allocations_proof FOREIGN KEY (payment_proof_id) REFERENCES payment_proofs(id),
  CONSTRAINT fk_payment_allocations_package FOREIGN KEY (client_package_id) REFERENCES client_packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_allocations_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
