SET NAMES utf8mb4;

-- Forward-only migration. Import once after 008_client_finance_allocations.sql.
-- It establishes one operational source of truth for client profiles, bookings,
-- studio timers, package consumption, finance classification and change polling.

ALTER TABLE clients
  ADD COLUMN contact_person VARCHAR(180) NULL AFTER company_name,
  ADD COLUMN address VARCHAR(255) NULL AFTER job,
  ADD COLUMN city VARCHAR(120) NULL AFTER address,
  ADD COLUMN tax_number VARCHAR(80) NULL AFTER city,
  ADD COLUMN commercial_registration VARCHAR(80) NULL AFTER tax_number,
  ADD COLUMN preferred_contact VARCHAR(24) NOT NULL DEFAULT 'whatsapp' AFTER commercial_registration,
  ADD COLUMN whatsapp_opt_in TINYINT(1) NOT NULL DEFAULT 1 AFTER preferred_contact,
  ADD COLUMN whatsapp_opt_in_at DATETIME NULL AFTER whatsapp_opt_in;

ALTER TABLE services
  ADD COLUMN deposit_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER payment_due_hours,
  ADD COLUMN overage_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER deposit_percent,
  ADD COLUMN minimum_booking_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60 AFTER validity_days,
  ADD COLUMN booking_increment_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15 AFTER minimum_booking_minutes,
  ADD COLUMN auto_start_timer TINYINT(1) NOT NULL DEFAULT 1 AFTER booking_increment_minutes;

-- Repair service templates created from the old settings form where billing_unit
-- silently fell back to hour even though the service is reel-based.
UPDATE services
SET billing_unit = 'reel'
WHERE billing_unit = 'hour'
  AND total_reels > 0
  AND total_hours = 0;

ALTER TABLE client_packages
  ADD COLUMN deposit_percent_snapshot DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER payment_due_quantity,
  ADD COLUMN overage_price_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER deposit_percent_snapshot,
  ADD COLUMN overage_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_price;

UPDATE client_packages cp
JOIN services s ON s.id = cp.service_id AND s.organization_id = cp.organization_id
SET cp.deposit_percent_snapshot = s.deposit_percent,
    cp.overage_price_snapshot = s.overage_price
WHERE cp.deposit_percent_snapshot = 0
  AND cp.overage_price_snapshot = 0;

ALTER TABLE package_usage_ledger
  ADD COLUMN event_key VARCHAR(190) NULL AFTER reason,
  ADD UNIQUE KEY uq_usage_event (client_package_id, event_key);

ALTER TABLE bookings
  ADD COLUMN timer_started_at DATETIME NULL AFTER actual_reels,
  ADD COLUMN timer_ended_at DATETIME NULL AFTER timer_started_at,
  ADD COLUMN actual_seconds INT UNSIGNED NOT NULL DEFAULT 0 AFTER timer_ended_at,
  ADD COLUMN billable_quantity DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER actual_seconds,
  ADD COLUMN overage_quantity DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER billable_quantity,
  ADD COLUMN overage_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER overage_quantity,
  ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER overage_amount,
  ADD KEY idx_bookings_auto_start (organization_id, status, date, start_time),
  ADD KEY idx_bookings_active_timer (organization_id, status, timer_started_at);

CREATE TABLE booking_slots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  slot_date DATE NOT NULL,
  slot_start TIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_resource_slot (organization_id, resource_id, slot_date, slot_start),
  KEY idx_booking_slots_booking (booking_id),
  CONSTRAINT fk_booking_slots_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_booking_slots_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_slots_resource FOREIGN KEY (resource_id) REFERENCES resources(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE booking_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  scheduled_start_at DATETIME NOT NULL,
  started_at DATETIME NOT NULL,
  ended_at DATETIME NULL,
  actual_seconds INT UNSIGNED NOT NULL DEFAULT 0,
  billable_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  start_source VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  started_by BIGINT UNSIGNED NULL,
  ended_by BIGINT UNSIGNED NULL,
  adjustment_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_session_booking (booking_id),
  KEY idx_booking_sessions_active (organization_id, status, started_at),
  KEY idx_booking_sessions_client (organization_id, client_id, status),
  CONSTRAINT fk_booking_sessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_booking_sessions_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_booking_sessions_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_booking_sessions_starter FOREIGN KEY (started_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_booking_sessions_ender FOREIGN KEY (ended_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE change_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  topic VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  action VARCHAR(32) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_change_events_org (organization_id, id),
  KEY idx_change_events_client (organization_id, client_id, id),
  CONSTRAINT fk_change_events_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_change_events_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE idempotency_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  request_key VARCHAR(190) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_status SMALLINT UNSIGNED NULL,
  response_body JSON NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'processing',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_idempotency_request (organization_id, user_id, request_key),
  KEY idx_idempotency_expiry (expires_at),
  CONSTRAINT fk_idempotency_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE app_notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  recipient_user_id BIGINT UNSIGNED NULL,
  audience VARCHAR(24) NOT NULL DEFAULT 'client',
  type VARCHAR(48) NOT NULL,
  title VARCHAR(180) NOT NULL,
  message VARCHAR(500) NOT NULL,
  entity_type VARCHAR(64) NULL,
  entity_id BIGINT UNSIGNED NULL,
  dedupe_key VARCHAR(190) NOT NULL,
  severity VARCHAR(16) NOT NULL DEFAULT 'info',
  read_at DATETIME NULL,
  dismissed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_notifications_dedupe (organization_id, dedupe_key),
  KEY idx_app_notifications_client (organization_id, audience, client_id, read_at, created_at),
  KEY idx_app_notifications_user (organization_id, recipient_user_id, read_at, created_at),
  CONSTRAINT fk_app_notifications_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_app_notifications_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_notifications_user FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE notification_queue
  ADD COLUMN dedupe_key VARCHAR(190) NULL AFTER template_key,
  ADD UNIQUE KEY uq_notification_queue_dedupe (organization_id, dedupe_key);

ALTER TABLE finance
  ADD COLUMN entry_kind VARCHAR(24) NOT NULL DEFAULT 'expense' AFTER type,
  ADD COLUMN category VARCHAR(80) NULL AFTER entry_kind,
  ADD COLUMN source_type VARCHAR(64) NULL AFTER entity,
  ADD COLUMN source_id BIGINT UNSIGNED NULL AFTER source_type,
  ADD COLUMN correlation_id VARCHAR(190) NULL AFTER source_id,
  ADD COLUMN is_system TINYINT(1) NOT NULL DEFAULT 0 AFTER correlation_id,
  ADD COLUMN reversed_entry_id BIGINT UNSIGNED NULL AFTER is_system,
  ADD KEY idx_finance_kind_date (organization_id, entry_kind, date),
  ADD KEY idx_finance_source (organization_id, source_type, source_id),
  ADD UNIQUE KEY uq_finance_correlation (organization_id, correlation_id),
  ADD CONSTRAINT fk_finance_reversal FOREIGN KEY (reversed_entry_id) REFERENCES finance(id) ON DELETE SET NULL;

ALTER TABLE payment_allocations
  MODIFY payment_proof_id BIGINT UNSIGNED NULL,
  DROP INDEX uq_payment_allocations_proof,
  ADD KEY idx_payment_allocations_proof (payment_proof_id);

UPDATE finance
SET entry_kind = CASE
  WHEN type IN ('إيراد','income') THEN 'income'
  WHEN type IN ('تحويل وارد','transfer_in') THEN 'transfer_in'
  WHEN type IN ('تحويل صادر','transfer_out') THEN 'transfer_out'
  WHEN type = 'سداد سلفة' THEN 'advance_in'
  WHEN type = 'سحب سلفة' THEN 'advance_out'
  WHEN type = 'سداد مستحقات' THEN 'settlement_out'
  ELSE 'expense'
END;
