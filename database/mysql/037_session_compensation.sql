SET NAMES utf8mb4;

-- Forward-only, repeat-safe live-session compensation. Existing sessions keep
-- their exact accounting because the new total defaults to zero.
DROP PROCEDURE IF EXISTS mta_037_add_column;
DROP PROCEDURE IF EXISTS mta_037_add_index;
DROP PROCEDURE IF EXISTS mta_037_add_constraint;

DELIMITER $$
CREATE PROCEDURE mta_037_add_column(IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='booking_sessions' AND COLUMN_NAME=p_column
  ) THEN
    SET @mta_037_sql=CONCAT('ALTER TABLE `booking_sessions` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE mta_037_stmt FROM @mta_037_sql; EXECUTE mta_037_stmt; DEALLOCATE PREPARE mta_037_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_037_add_index(IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='booking_sessions' AND INDEX_NAME=p_index
  ) THEN
    SET @mta_037_sql=CONCAT('ALTER TABLE `booking_sessions` ADD ',p_definition);
    PREPARE mta_037_stmt FROM @mta_037_sql; EXECUTE mta_037_stmt; DEALLOCATE PREPARE mta_037_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_037_add_constraint(IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='booking_sessions' AND CONSTRAINT_NAME=p_constraint
  ) THEN
    SET @mta_037_sql=CONCAT('ALTER TABLE `booking_sessions` ADD CONSTRAINT `',p_constraint,'` ',p_definition);
    PREPARE mta_037_stmt FROM @mta_037_sql; EXECUTE mta_037_stmt; DEALLOCATE PREPARE mta_037_stmt;
  END IF;
END$$
DELIMITER ;

CALL mta_037_add_column('complimentary_seconds','INT UNSIGNED NOT NULL DEFAULT 0 AFTER `actual_seconds`');
CALL mta_037_add_column('complimentary_reason','VARCHAR(500) NULL AFTER `adjustment_reason`');
CALL mta_037_add_column('complimentary_updated_by','BIGINT UNSIGNED NULL AFTER `complimentary_reason`');
CALL mta_037_add_column('complimentary_updated_at','DATETIME NULL AFTER `complimentary_updated_by`');
CALL mta_037_add_index('idx_booking_sessions_compensation_user','KEY `idx_booking_sessions_compensation_user` (`complimentary_updated_by`)');
CALL mta_037_add_constraint('fk_booking_sessions_compensation_user','FOREIGN KEY (`complimentary_updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

DROP PROCEDURE IF EXISTS mta_037_add_constraint;
DROP PROCEDURE IF EXISTS mta_037_add_index;
DROP PROCEDURE IF EXISTS mta_037_add_column;
