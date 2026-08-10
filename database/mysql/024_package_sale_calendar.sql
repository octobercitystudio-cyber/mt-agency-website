SET NAMES utf8mb4;

-- Repeatable package-validity migration. Safe to run after 023 on MySQL/MariaDB.
DROP PROCEDURE IF EXISTS mta_024_add_column;
DELIMITER $$
CREATE PROCEDURE mta_024_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @mta_024_sql=CONCAT('ALTER TABLE `',p_table,'` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE mta_024_stmt FROM @mta_024_sql;
    EXECUTE mta_024_stmt;
    DEALLOCATE PREPARE mta_024_stmt;
  END IF;
END$$
DELIMITER ;

CALL mta_024_add_column('services','package_validity_mode',"ENUM('rolling','shooting_day') NOT NULL DEFAULT 'rolling' AFTER `validity_days`");
CALL mta_024_add_column('client_packages','validity_mode_snapshot',"ENUM('rolling','shooting_day') NOT NULL DEFAULT 'rolling' AFTER `expires_at`");

-- Only templates are classified. Existing sold-package dates remain untouched.
UPDATE services
SET package_validity_mode='shooting_day'
WHERE LOWER(TRIM(category)) IN (
  'daily', 'daily package', 'day package',
  'باقة يومية', 'باقات يومية', 'الباقات اليومية', 'باقة اليوم'
);

DROP PROCEDURE IF EXISTS mta_024_add_column;
