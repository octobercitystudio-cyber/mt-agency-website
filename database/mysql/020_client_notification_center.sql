-- Safe, client-facing notification destinations and source identity.
-- Repeatable on Hostinger/MySQL installations that may run migrations more than once.
SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='app_notifications' AND COLUMN_NAME='action_tab'),
  'SELECT 1',
  "ALTER TABLE app_notifications ADD COLUMN action_tab VARCHAR(24) NULL AFTER severity"
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='app_notifications' AND COLUMN_NAME='payload_json'),
  'SELECT 1',
  "ALTER TABLE app_notifications ADD COLUMN payload_json JSON NULL AFTER action_tab"
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='app_notifications' AND COLUMN_NAME='source_event_key'),
  'SELECT 1',
  "ALTER TABLE app_notifications ADD COLUMN source_event_key VARCHAR(190) NULL AFTER payload_json"
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='app_notifications' AND INDEX_NAME='idx_app_notifications_client_cursor'),
  'SELECT 1',
  "ALTER TABLE app_notifications ADD KEY idx_app_notifications_client_cursor (organization_id,audience,client_id,dismissed_at,id)"
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@schema_name AND TABLE_NAME='app_notifications' AND INDEX_NAME='uq_app_notifications_source_event'),
  'SELECT 1',
  "ALTER TABLE app_notifications ADD UNIQUE KEY uq_app_notifications_source_event (organization_id,source_event_key)"
); PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
