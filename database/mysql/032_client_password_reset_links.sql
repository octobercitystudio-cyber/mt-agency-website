-- Retire legacy expiring-password state without changing credentials or access.
-- Forward-only, repeatable and safe after migration 021.
SET @schema_name = DATABASE();
SET @has_dependency = (
  SELECT COUNT(*) = 3
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME IN ('password_status','temporary_expires_at','role')
);
SET @sql = IF(
  @has_dependency,
  "UPDATE users SET password_status='active', temporary_expires_at=NULL WHERE role='client' AND password_status='temporary'",
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
