SET NAMES utf8mb4;

ALTER TABLE payment_proofs
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32) NULL AFTER amount,
  ADD COLUMN IF NOT EXISTS transfer_account_snapshot VARCHAR(64) NULL AFTER payment_method;

CREATE TABLE IF NOT EXISTS promotion_subscriptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  promotion_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'interested',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_promotion_client (organization_id, promotion_id, client_id),
  KEY idx_promotion_subscriptions_client (organization_id, client_id, created_at),
  KEY idx_promotion_subscriptions_promotion (organization_id, promotion_id, created_at),
  CONSTRAINT fk_promotion_subscriptions_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_promotion_subscriptions_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  CONSTRAINT fk_promotion_subscriptions_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
