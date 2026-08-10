-- Compatibility cleanup for credential security migration 021.
-- users.is_active is the only portal-access authority. Legacy password_status
-- values are normalized without changing access, must-change, or expiry fields.
SET @schema_name = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='users'
     AND COLUMN_NAME IN ('password_status','must_change_password','temporary_expires_at')) = 3,
  "UPDATE users
     SET password_status = CASE
       WHEN must_change_password = 1 AND temporary_expires_at IS NOT NULL THEN 'temporary'
       ELSE 'active'
     END
   WHERE role = 'client' AND password_status = 'disabled'",
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
