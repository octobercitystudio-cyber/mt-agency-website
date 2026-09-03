SET NAMES utf8mb4;

-- Forward-only, repeat-safe administrative booking blocks. Existing bookings
-- and slot rows are preserved; only the slot owner becomes nullable so one
-- slot can belong to either a booking or an administrative block.

CREATE TABLE IF NOT EXISTS booking_blocks (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  organization_id BIGINT UNSIGNED NOT NULL,
  resource_id BIGINT UNSIGNED NOT NULL,
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_minutes SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL DEFAULT 'الحجز مغلق',
  note VARCHAR(1000) NULL,
  series_key CHAR(36) NULL,
  idempotency_key VARCHAR(160) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_json JSON NULL,
  status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
  created_by BIGINT UNSIGNED NOT NULL,
  cancelled_by BIGINT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_blocks_idempotency (organization_id,idempotency_key),
  KEY idx_booking_blocks_calendar (organization_id,block_date,resource_id,status,start_time),
  KEY idx_booking_blocks_series (organization_id,series_key,block_date,status),
  CONSTRAINT fk_booking_blocks_org FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_booking_blocks_resource FOREIGN KEY (resource_id) REFERENCES resources(id),
  CONSTRAINT fk_booking_blocks_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_booking_blocks_canceller FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS mta_036_add_column;
DROP PROCEDURE IF EXISTS mta_036_add_index;
DROP PROCEDURE IF EXISTS mta_036_add_constraint;

DELIMITER $$
CREATE PROCEDURE mta_036_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @mta_036_sql=CONCAT('ALTER TABLE `',p_table,'` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE mta_036_stmt FROM @mta_036_sql; EXECUTE mta_036_stmt; DEALLOCATE PREPARE mta_036_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_036_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND INDEX_NAME=p_index
  ) THEN
    SET @mta_036_sql=CONCAT('ALTER TABLE `',p_table,'` ADD ',p_definition);
    PREPARE mta_036_stmt FROM @mta_036_sql; EXECUTE mta_036_stmt; DEALLOCATE PREPARE mta_036_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_036_add_constraint(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND CONSTRAINT_NAME=p_constraint
  ) THEN
    SET @mta_036_sql=CONCAT('ALTER TABLE `',p_table,'` ADD CONSTRAINT `',p_constraint,'` ',p_definition);
    PREPARE mta_036_stmt FROM @mta_036_sql; EXECUTE mta_036_stmt; DEALLOCATE PREPARE mta_036_stmt;
  END IF;
END$$
DELIMITER ;

-- MODIFY is guarded separately because the column already exists.
SET @mta_036_sql=IF(
  EXISTS(SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='booking_slots' AND COLUMN_NAME='booking_id' AND IS_NULLABLE='NO'),
  'ALTER TABLE booking_slots MODIFY COLUMN booking_id BIGINT UNSIGNED NULL',
  'SELECT 1'
);
PREPARE mta_036_stmt FROM @mta_036_sql; EXECUTE mta_036_stmt; DEALLOCATE PREPARE mta_036_stmt;

CALL mta_036_add_column('booking_slots','booking_block_id','BIGINT UNSIGNED NULL AFTER `booking_id`');
CALL mta_036_add_index('booking_slots','idx_booking_slots_block','KEY `idx_booking_slots_block` (`booking_block_id`)');
CALL mta_036_add_constraint('booking_slots','fk_booking_slots_block','FOREIGN KEY (`booking_block_id`) REFERENCES `booking_blocks`(`id`) ON DELETE CASCADE');
CALL mta_036_add_constraint('booking_slots','chk_booking_slots_one_owner','CHECK ((`booking_id` IS NOT NULL) <> (`booking_block_id` IS NOT NULL))');

DROP PROCEDURE IF EXISTS mta_036_add_constraint;
DROP PROCEDURE IF EXISTS mta_036_add_index;
DROP PROCEDURE IF EXISTS mta_036_add_column;
