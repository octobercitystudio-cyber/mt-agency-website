SET NAMES utf8mb4;
SET time_zone = '+02:00';

CREATE TABLE IF NOT EXISTS organizations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Cairo',
  currency CHAR(3) NOT NULL DEFAULT 'EGP',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  name VARCHAR(180) NOT NULL,
  company_name VARCHAR(180) NULL,
  phone1 VARCHAR(32) NOT NULL,
  phone2 VARCHAR(32) NULL,
  email VARCHAR(190) NULL,
  job VARCHAR(160) NULL,
  color VARCHAR(16) NOT NULL DEFAULT '#6D28D9',
  notes TEXT NULL,
  debt DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  points DECIMAL(12,2) NOT NULL DEFAULT 0,
  points_updated_at DATE NULL,
  dismissed_alerts LONGTEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_clients_org_phone (organization_id, phone1),
  KEY idx_clients_org_name (organization_id, name),
  CONSTRAINT fk_clients_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'client',
  permissions JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  last_login_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_client (client_id),
  CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_users_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  ip_hash CHAR(64) NULL,
  user_agent_hash CHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_api_sessions_token (token_hash),
  KEY idx_api_sessions_user (user_id),
  KEY idx_api_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL,
  billing_unit VARCHAR(24) NOT NULL DEFAULT 'hour',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  payment_due_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_reels INT UNSIGNED NOT NULL DEFAULT 0,
  validity_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_services_org_name (organization_id, name),
  CONSTRAINT fk_services_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resources (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(40) NOT NULL DEFAULT 'studio',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_resources_org_name (organization_id, name),
  CONSTRAINT fk_resources_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_packages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(180) NOT NULL,
  billing_unit VARCHAR(24) NOT NULL,
  purchased_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  held_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  consumed_quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  starts_at DATE NULL,
  expires_at DATE NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_packages_client_status (client_id, status, expires_at),
  CONSTRAINT fk_packages_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_packages_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_packages_service FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NOT NULL,
  client_package_id BIGINT UNSIGNED NULL,
  service_id BIGINT UNSIGNED NULL,
  resource_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_name VARCHAR(180) NOT NULL,
  service VARCHAR(180) NOT NULL,
  date DATE NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  requested_quantity DECIMAL(8,2) NOT NULL DEFAULT 0,
  actual_hours DECIMAL(8,2) NOT NULL DEFAULT 0,
  actual_reels INT UNSIGNED NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  delivery_date DATE NULL,
  base_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  custom_price DECIMAL(12,2) NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_reason VARCHAR(255) NULL,
  payment DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  cancellation_charge TINYINT(1) NULL,
  cancellation_override_reason VARCHAR(255) NULL,
  decided_by BIGINT UNSIGNED NULL,
  decided_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_bookings_calendar (organization_id, resource_id, date, start_time, end_time),
  KEY idx_bookings_client (client_id, date),
  KEY idx_bookings_status (organization_id, status, date),
  CONSTRAINT fk_bookings_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_bookings_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_bookings_package FOREIGN KEY (client_package_id) REFERENCES client_packages(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_resource FOREIGN KEY (resource_id) REFERENCES resources(id),
  CONSTRAINT fk_bookings_decider FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_bookings_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS booking_status_history (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  note VARCHAR(255) NULL,
  changed_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_booking_history (booking_id, created_at),
  CONSTRAINT fk_history_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_history_user FOREIGN KEY (changed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reschedule_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  booking_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  proposed_date DATE NOT NULL,
  proposed_start_time TIME NOT NULL,
  proposed_end_time TIME NOT NULL,
  reason TEXT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  decided_by BIGINT UNSIGNED NULL,
  decided_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reschedule_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_reschedule_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  CONSTRAINT fk_reschedule_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_reschedule_user FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS package_usage_ledger (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  client_package_id BIGINT UNSIGNED NOT NULL,
  booking_id BIGINT UNSIGNED NULL,
  movement_type VARCHAR(24) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_usage_package (client_package_id, created_at),
  CONSTRAINT fk_usage_package FOREIGN KEY (client_package_id) REFERENCES client_packages(id),
  CONSTRAINT fk_usage_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  CONSTRAINT fk_usage_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS finance (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NULL,
  employee_user_id BIGINT UNSIGNED NULL,
  type VARCHAR(48) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(64) NULL,
  detail VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  entity VARCHAR(80) NOT NULL DEFAULT 'الشركة',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_finance_org_date (organization_id, date),
  KEY idx_finance_org_employee_date (organization_id, employee_user_id, date),
  CONSTRAINT fk_finance_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_finance_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_employee_user FOREIGN KEY (employee_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_finance_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NOT NULL,
  client_name VARCHAR(180) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method VARCHAR(64) NOT NULL DEFAULT 'bank_transfer',
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  reference VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_payments_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_payments_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_payments_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NULL,
  offer_number VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valid_until DATE NULL,
  notes TEXT NULL,
  accepted_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_offers_number (organization_id, offer_number),
  CONSTRAINT fk_offers_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_offers_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  CONSTRAINT fk_offers_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS offer_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  offer_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit VARCHAR(24) NOT NULL DEFAULT 'project',
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  metadata JSON NULL,
  CONSTRAINT fk_offer_items_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NOT NULL,
  offer_id BIGINT UNSIGNED NULL,
  invoice_number VARCHAR(40) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'issued',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  issued_at DATE NOT NULL,
  due_at DATE NULL,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_invoices_number (organization_id, invoice_number),
  CONSTRAINT fk_invoices_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_invoices_offer FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  invoice_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit VARCHAR(24) NOT NULL DEFAULT 'project',
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notification_queue (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  client_id BIGINT UNSIGNED NOT NULL,
  channel VARCHAR(24) NOT NULL DEFAULT 'whatsapp',
  template_key VARCHAR(80) NOT NULL,
  recipient VARCHAR(32) NOT NULL,
  payload JSON NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME NULL,
  last_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_notification_worker (status, available_at),
  CONSTRAINT fk_notifications_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_notifications_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_proofs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(32) NULL,
  transfer_account_snapshot VARCHAR(64) NULL,
  file_path VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  CONSTRAINT fk_proofs_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL,
  CONSTRAINT fk_proofs_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT fk_proofs_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reminders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  type VARCHAR(48) NOT NULL DEFAULT 'task',
  due_date DATETIME NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  recurrence VARCHAR(24) NULL,
  notify_before SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_recurring TINYINT(1) NOT NULL DEFAULT 0,
  amount DECIMAL(12,2) NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reminders_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_reminders_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  `key` VARCHAR(120) NOT NULL,
  value LONGTEXT NULL,
  type VARCHAR(24) NOT NULL DEFAULT 'text',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_config_org_key (organization_id, `key`),
  CONSTRAINT fk_config_org FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  before_data JSON NULL,
  after_data JSON NULL,
  ip_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_org_time (organization_id, created_at),
  CONSTRAINT fk_audit_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO organizations (id, name, timezone, currency)
VALUES (1, 'MT Agency', 'Africa/Cairo', 'EGP')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO resources (id, organization_id, name, type)
VALUES (1, 1, 'الاستديو الرئيسي', 'studio')
ON DUPLICATE KEY UPDATE name = VALUES(name);

-- The post-production tables depend on booking_sessions, which is introduced
-- by migration 009. Fresh installations must continue through migration 031:
-- database/mysql/031_post_production_and_video_deliveries.sql
