SET NAMES utf8mb4;

-- Links employee movements to a stable organization-scoped user identity.
-- Safe to import repeatedly on Hostinger after 026_package_first_booking_validity.sql.
DROP PROCEDURE IF EXISTS mta_027_add_column;
DROP PROCEDURE IF EXISTS mta_027_add_index;
DROP PROCEDURE IF EXISTS mta_027_add_constraint;

DELIMITER $$
CREATE PROCEDURE mta_027_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND COLUMN_NAME=p_column
  ) THEN
    SET @mta_027_sql=CONCAT('ALTER TABLE `',p_table,'` ADD COLUMN `',p_column,'` ',p_definition);
    PREPARE mta_027_stmt FROM @mta_027_sql; EXECUTE mta_027_stmt; DEALLOCATE PREPARE mta_027_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_027_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND INDEX_NAME=p_index
  ) THEN
    SET @mta_027_sql=CONCAT('ALTER TABLE `',p_table,'` ADD ',p_definition);
    PREPARE mta_027_stmt FROM @mta_027_sql; EXECUTE mta_027_stmt; DEALLOCATE PREPARE mta_027_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_027_add_constraint(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME=p_table AND CONSTRAINT_NAME=p_constraint
  ) THEN
    SET @mta_027_sql=CONCAT('ALTER TABLE `',p_table,'` ADD CONSTRAINT `',p_constraint,'` ',p_definition);
    PREPARE mta_027_stmt FROM @mta_027_sql; EXECUTE mta_027_stmt; DEALLOCATE PREPARE mta_027_stmt;
  END IF;
END$$
DELIMITER ;

CALL mta_027_add_column('finance','employee_user_id','BIGINT UNSIGNED NULL AFTER `client_id`');
CALL mta_027_add_index('finance','idx_finance_org_employee_date','KEY `idx_finance_org_employee_date` (`organization_id`,`employee_user_id`,`date`)');
CALL mta_027_add_constraint('finance','fk_finance_employee_user','FOREIGN KEY (`employee_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL');

-- Only exact, unique organization-scoped aliases are linked. If an organization
-- has two active users named Ashraf/Marwa, no legacy row is guessed.
DROP TEMPORARY TABLE IF EXISTS mta_027_employee_candidates;
CREATE TEMPORARY TABLE mta_027_employee_candidates (
  organization_id BIGINT UNSIGNED NOT NULL,
  employee_key VARCHAR(16) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (organization_id, employee_key)
) ENGINE=MEMORY;

INSERT INTO mta_027_employee_candidates (organization_id,employee_key,user_id)
SELECT organization_id,employee_key,MIN(id)
FROM (
  SELECT id,organization_id,
    CASE
      WHEN TRIM(SUBSTRING_INDEX(full_name,' ',1)) IN ('اشرف','أشرف') THEN 'ashraf'
      WHEN TRIM(SUBSTRING_INDEX(full_name,' ',1))='مروة' THEN 'marwa'
      ELSE NULL
    END employee_key
  FROM users
  WHERE is_active=1 AND role<>'client'
) candidates
WHERE employee_key IS NOT NULL
GROUP BY organization_id,employee_key
HAVING COUNT(*)=1;

UPDATE finance f
JOIN mta_027_employee_candidates c
  ON c.organization_id=f.organization_id
 AND c.employee_key=CASE
   WHEN TRIM(f.entity) IN ('اشرف','أشرف') THEN 'ashraf'
   WHEN TRIM(f.entity)='مروة' THEN 'marwa'
   ELSE NULL
 END
SET f.employee_user_id=c.user_id
WHERE f.employee_user_id IS NULL;

-- Preserve stable linkage on historic reversal rows as well.
UPDATE finance reversal_entry
JOIN finance original
  ON original.id=reversal_entry.reversed_entry_id
 AND original.organization_id=reversal_entry.organization_id
SET reversal_entry.employee_user_id=original.employee_user_id
WHERE reversal_entry.employee_user_id IS NULL
  AND original.employee_user_id IS NOT NULL;

DROP TEMPORARY TABLE IF EXISTS mta_027_employee_candidates;
DROP PROCEDURE IF EXISTS mta_027_add_column;
DROP PROCEDURE IF EXISTS mta_027_add_index;
DROP PROCEDURE IF EXISTS mta_027_add_constraint;
