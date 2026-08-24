-- MT Agency ERP - fixed employee attendance and lateness payroll rule
-- Forward-only and data-preserving. This migration does not modify attendance
-- records, payroll adjustments, finance entries, or any historical transaction.

INSERT INTO attendance_policies (
  organization_id,
  user_id,
  track_attendance,
  scheduled_start,
  working_weekdays,
  grace_minutes,
  late_multiplier,
  effective_from,
  created_by
)
SELECT
  u.organization_id,
  u.id,
  1,
  '12:00:00',
  JSON_ARRAY(0, 1, 2, 3, 4),
  15,
  1,
  CURRENT_DATE,
  NULL
FROM users u
WHERE u.is_active = 1
  AND u.role IN ('admin', 'operations', 'finance', 'staff')
ON DUPLICATE KEY UPDATE
  track_attendance = 1,
  scheduled_start = '12:00:00',
  grace_minutes = 15,
  late_multiplier = 1;

-- The owner and client accounts never participate in employee attendance.
UPDATE attendance_policies p
JOIN users u
  ON u.id = p.user_id
 AND u.organization_id = p.organization_id
SET p.track_attendance = 0
WHERE u.role IN ('owner', 'client');
