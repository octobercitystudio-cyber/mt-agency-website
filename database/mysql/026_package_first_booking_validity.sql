SET NAMES utf8mb4;

-- New packages remain unactivated until their first confirmed photography
-- booking. Existing package dates are intentionally preserved.
ALTER TABLE client_packages
  MODIFY starts_at DATE NULL,
  MODIFY expires_at DATE NULL;

DROP PROCEDURE IF EXISTS mta_026_add_column;
DELIMITER $$
CREATE PROCEDURE mta_026_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @mta_026_sql=CONCAT('ALTER TABLE `',p_table,'` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE mta_026_stmt FROM @mta_026_sql;
    EXECUTE mta_026_stmt;
    DEALLOCATE PREPARE mta_026_stmt;
  END IF;
END$$
DELIMITER ;

CALL mta_026_add_column('client_packages','validity_days_snapshot','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `validity_mode_snapshot`');

-- Preserve a useful snapshot for packages sold before this migration without
-- changing their existing start/end dates.
UPDATE client_packages
SET validity_days_snapshot=GREATEST(1,DATEDIFF(expires_at,starts_at)+1)
WHERE starts_at IS NOT NULL AND expires_at IS NOT NULL AND validity_days_snapshot=1;

DROP PROCEDURE IF EXISTS mta_026_add_column;
