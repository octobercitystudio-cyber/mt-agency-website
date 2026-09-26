-- Successful devices must not be re-notified when another device needs a retry.
CREATE TABLE IF NOT EXISTS app_push_delivery_receipts (
  job_id BIGINT UNSIGNED NOT NULL,
  subscription_id BIGINT UNSIGNED NOT NULL,
  organization_id BIGINT UNSIGNED NOT NULL,
  sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id, subscription_id),
  CONSTRAINT fk_push_receipt_job FOREIGN KEY (job_id) REFERENCES app_push_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_push_receipt_subscription FOREIGN KEY (subscription_id) REFERENCES app_push_subscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
