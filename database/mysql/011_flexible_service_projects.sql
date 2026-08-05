SET NAMES utf8mb4;

-- Forward-only migration. Import once after 010_manual_timer_duration.sql.
-- Studio hour/day/month packages remain in client_packages. Every other service
-- is represented by a flexible project with its own scope, milestones, invoice,
-- optional calendar reservation and client-visible progress.

ALTER TABLE projects
  ADD COLUMN invoice_id BIGINT UNSIGNED NULL AFTER client_package_id,
  ADD COLUMN service_type VARCHAR(40) NOT NULL DEFAULT 'custom' AFTER category,
  ADD COLUMN pricing_model VARCHAR(32) NOT NULL DEFAULT 'custom' AFTER service_type,
  ADD COLUMN quantity DECIMAL(12,4) NOT NULL DEFAULT 1 AFTER pricing_model,
  ADD COLUMN unit_label VARCHAR(40) NOT NULL DEFAULT 'project' AFTER quantity,
  ADD COLUMN agreed_price DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER unit_label,
  ADD COLUMN requires_booking TINYINT(1) NOT NULL DEFAULT 0 AFTER agreed_price,
  ADD COLUMN requirements_json JSON NULL AFTER requires_booking,
  ADD COLUMN progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER requirements_json,
  ADD KEY idx_projects_service_type (organization_id, service_type, status),
  ADD KEY idx_projects_invoice (invoice_id),
  ADD CONSTRAINT fk_projects_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;

ALTER TABLE invoices
  ADD COLUMN project_id BIGINT UNSIGNED NULL AFTER offer_id,
  ADD KEY idx_invoices_project (project_id),
  ADD CONSTRAINT fk_invoices_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

ALTER TABLE bookings
  ADD COLUMN project_id BIGINT UNSIGNED NULL AFTER client_package_id,
  ADD KEY idx_bookings_project (project_id, date),
  ADD CONSTRAINT fk_bookings_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL;

CREATE TABLE project_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  item_type VARCHAR(40) NOT NULL DEFAULT 'service',
  description VARCHAR(255) NOT NULL,
  quantity DECIMAL(12,4) NOT NULL DEFAULT 1,
  unit VARCHAR(40) NOT NULL DEFAULT 'item',
  unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  internal_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  metadata JSON NULL,
  is_client_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_project_items_project (project_id, sort_order),
  KEY idx_project_items_client (organization_id, client_id, project_id),
  CONSTRAINT fk_project_items_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_project_items_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_items_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE project_milestones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(220) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  progress_percent TINYINT UNSIGNED NOT NULL DEFAULT 0,
  due_at DATETIME NULL,
  completed_at DATETIME NULL,
  client_note TEXT NULL,
  internal_note TEXT NULL,
  is_client_visible TINYINT(1) NOT NULL DEFAULT 1,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_project_milestones_project (project_id, sort_order),
  KEY idx_project_milestones_client (organization_id, client_id, status),
  CONSTRAINT fk_project_milestones_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_project_milestones_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_project_milestones_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing work is kept, but is explicitly classified as a custom project.
UPDATE projects
SET service_type = CASE
      WHEN category IN ('social_media', 'social') THEN 'social_media'
      WHEN category IN ('digital_marketing', 'digital') THEN 'social_media'
      WHEN category IN ('advertising', 'ad') THEN 'advertising'
      ELSE 'custom'
    END,
    pricing_model = 'custom',
    unit_label = 'project',
    progress_percent = CASE status
      WHEN 'completed' THEN 100
      WHEN 'review' THEN 85
      WHEN 'in_progress' THEN 50
      WHEN 'planning' THEN 10
      ELSE 0
    END
WHERE service_type = 'custom';
