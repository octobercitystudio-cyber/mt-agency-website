SET NAMES utf8mb4;

-- Forward-only accuracy migration. Run once after 013_social_profits.sql.
-- Only invoice allocations with exactly one linked package are safe to backfill.
UPDATE payment_allocations pa
JOIN (
  SELECT organization_id, source_invoice_id, MIN(id) AS package_id
  FROM client_packages
  WHERE source_invoice_id IS NOT NULL
  GROUP BY organization_id, source_invoice_id
  HAVING COUNT(*) = 1
) exact_invoice
  ON exact_invoice.organization_id = pa.organization_id
 AND exact_invoice.source_invoice_id = pa.invoice_id
SET pa.client_package_id = exact_invoice.package_id
WHERE pa.client_package_id IS NULL
  AND pa.invoice_id IS NOT NULL;

ALTER TABLE payment_allocations
  ADD KEY idx_alloc_package_history (organization_id, client_package_id, created_at),
  ADD KEY idx_alloc_invoice_history (organization_id, invoice_id, created_at);

ALTER TABLE package_usage_ledger
  ADD KEY idx_usage_package_history (client_package_id, created_at, booking_id);
