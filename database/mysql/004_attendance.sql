-- MT Agency ERP - Attendance and payroll deductions
-- Forward-only migration. Import after 003_projects_and_content.sql.

CREATE TABLE IF NOT EXISTS attendance_policies (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  track_attendance TINYINT(1) NOT NULL DEFAULT 1,
  scheduled_start TIME NOT NULL DEFAULT '12:00:00',
  scheduled_end TIME NOT NULL DEFAULT '24:00:00',
  working_weekdays JSON NOT NULL,
  grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
  monthly_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  expected_working_days SMALLINT UNSIGNED NOT NULL DEFAULT 26,
  absence_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1,
  late_multiplier DECIMAL(6,3) NOT NULL DEFAULT 1,
  early_leave_deduction_enabled TINYINT(1) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_policy_user (organization_id, user_id),
  KEY idx_attendance_policy_active (organization_id, track_attendance, effective_from, effective_to),
  CONSTRAINT fk_attendance_policy_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_attendance_policy_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_policy_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_records (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  policy_id BIGINT UNSIGNED NULL,
  work_date DATE NOT NULL,
  scheduled_start TIME NOT NULL,
  scheduled_end TIME NOT NULL,
  grace_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  policy_snapshot JSON NOT NULL,
  check_in_at DATETIME NULL,
  check_out_at DATETIME NULL,
  last_activity_at DATETIME NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'login',
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  late_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  early_leave_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  notes TEXT NULL,
  corrected_by BIGINT UNSIGNED NULL,
  correction_reason VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_user_day (organization_id, user_id, work_date),
  KEY idx_attendance_org_day (organization_id, work_date, status),
  KEY idx_attendance_user_month (user_id, work_date),
  CONSTRAINT fk_attendance_record_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_attendance_record_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_record_policy FOREIGN KEY (policy_id) REFERENCES attendance_policies(id) ON DELETE SET NULL,
  CONSTRAINT fk_attendance_record_corrector FOREIGN KEY (corrected_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendance_adjustments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  attendance_record_id BIGINT UNSIGNED NULL,
  adjustment_month CHAR(7) NOT NULL,
  adjustment_type VARCHAR(32) NOT NULL DEFAULT 'deduction',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  minutes INT NOT NULL DEFAULT 0,
  reason VARCHAR(500) NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_attendance_adjustment_month (organization_id, adjustment_month, user_id),
  CONSTRAINT fk_attendance_adjustment_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_attendance_adjustment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_adjustment_record FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE SET NULL,
  CONSTRAINT fk_attendance_adjustment_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing owners are exempt by default. Future staff policies are created on first login
-- or can be configured in the attendance screen before their first working day.
INSERT INTO attendance_policies
  (organization_id, user_id, track_attendance, working_weekdays, effective_from, created_by)
SELECT organization_id, id, 0, JSON_ARRAY(0,1,2,3,4), CURDATE(), id
FROM users
WHERE role = 'owner'
ON DUPLICATE KEY UPDATE user_id = VALUES(user_id);
