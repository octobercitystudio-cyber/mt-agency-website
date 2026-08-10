SET NAMES utf8mb4;

-- Repeatable lifecycle migration after 016_security_hardening.sql.
-- Every schema change is guarded through information_schema so an interrupted
-- Hostinger deployment can safely run this file again.

DROP PROCEDURE IF EXISTS mta_add_column;
DROP PROCEDURE IF EXISTS mta_add_index;
DROP PROCEDURE IF EXISTS mta_add_constraint;

DELIMITER $$
CREATE PROCEDURE mta_add_column(IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
  ) THEN
    SET @mta_sql = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN `', p_column, '` ', p_definition);
    PREPARE mta_stmt FROM @mta_sql; EXECUTE mta_stmt; DEALLOCATE PREPARE mta_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_add_index(IN p_table VARCHAR(64), IN p_index VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND INDEX_NAME = p_index
  ) THEN
    SET @mta_sql = CONCAT('ALTER TABLE `', p_table, '` ADD ', p_definition);
    PREPARE mta_stmt FROM @mta_sql; EXECUTE mta_stmt; DEALLOCATE PREPARE mta_stmt;
  END IF;
END$$

CREATE PROCEDURE mta_add_constraint(IN p_table VARCHAR(64), IN p_constraint VARCHAR(64), IN p_definition TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND CONSTRAINT_NAME = p_constraint
  ) THEN
    SET @mta_sql = CONCAT('ALTER TABLE `', p_table, '` ADD CONSTRAINT `', p_constraint, '` ', p_definition);
    PREPARE mta_stmt FROM @mta_sql; EXECUTE mta_stmt; DEALLOCATE PREPARE mta_stmt;
  END IF;
END$$
DELIMITER ;

CALL mta_add_column('clients','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('clients','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('clients','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('clients','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_index('clients','idx_clients_archive_state','KEY `idx_clients_archive_state` (`organization_id`,`archived_at`,`status`)');
CALL mta_add_constraint('clients','fk_clients_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('bookings','archive_reason','VARCHAR(500) NULL AFTER `cancellation_override_reason`');
CALL mta_add_column('bookings','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('bookings','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('bookings','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_index('bookings','idx_bookings_archive_state','KEY `idx_bookings_archive_state` (`organization_id`,`archived_at`,`status`)');
CALL mta_add_constraint('bookings','fk_bookings_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('projects','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('projects','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('projects','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('projects','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_index('projects','idx_projects_archive_state','KEY `idx_projects_archive_state` (`organization_id`,`archived_at`,`status`)');
CALL mta_add_constraint('projects','fk_projects_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('project_tasks','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('project_tasks','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('project_tasks','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('project_tasks','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_constraint('project_tasks','fk_project_tasks_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('project_items','status','VARCHAR(32) NOT NULL DEFAULT ''draft'' AFTER `description`');
CALL mta_add_column('project_items','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('project_items','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('project_items','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('project_items','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_constraint('project_items','fk_project_items_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('project_milestones','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('project_milestones','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('project_milestones','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('project_milestones','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_constraint('project_milestones','fk_project_milestones_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('content_items','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('content_items','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('content_items','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('content_items','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_constraint('content_items','fk_content_items_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('reminders','archive_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('reminders','archived_by','BIGINT UNSIGNED NULL AFTER `archive_reason`');
CALL mta_add_column('reminders','archived_at','DATETIME NULL AFTER `archived_by`');
CALL mta_add_column('reminders','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `archived_at`');
CALL mta_add_constraint('reminders','fk_reminders_archived_by','FOREIGN KEY (`archived_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('offers','cancellation_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('offers','cancelled_by','BIGINT UNSIGNED NULL AFTER `cancellation_reason`');
CALL mta_add_column('offers','cancelled_at','DATETIME NULL AFTER `cancelled_by`');
CALL mta_add_column('offers','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `cancelled_at`');
CALL mta_add_constraint('offers','fk_offers_cancelled_by','FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('invoices','cancellation_reason','VARCHAR(500) NULL AFTER `status`');
CALL mta_add_column('invoices','cancelled_by','BIGINT UNSIGNED NULL AFTER `cancellation_reason`');
CALL mta_add_column('invoices','cancelled_at','DATETIME NULL AFTER `cancelled_by`');
CALL mta_add_column('invoices','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `cancelled_at`');
CALL mta_add_constraint('invoices','fk_invoices_cancelled_by','FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('users','deactivation_reason','VARCHAR(500) NULL AFTER `is_active`');
CALL mta_add_column('users','deactivated_by','BIGINT UNSIGNED NULL AFTER `deactivation_reason`');
CALL mta_add_column('users','deactivated_at','DATETIME NULL AFTER `deactivated_by`');
CALL mta_add_column('users','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `deactivated_at`');
CALL mta_add_constraint('users','fk_users_deactivated_by','FOREIGN KEY (`deactivated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('resources','deactivation_reason','VARCHAR(500) NULL AFTER `is_active`');
CALL mta_add_column('resources','deactivated_by','BIGINT UNSIGNED NULL AFTER `deactivation_reason`');
CALL mta_add_column('resources','deactivated_at','DATETIME NULL AFTER `deactivated_by`');
CALL mta_add_column('resources','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `deactivated_at`');
CALL mta_add_constraint('resources','fk_resources_deactivated_by','FOREIGN KEY (`deactivated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');

CALL mta_add_column('attendance_adjustments','void_reason','VARCHAR(500) NULL AFTER `reason`');
CALL mta_add_column('attendance_adjustments','voided_by','BIGINT UNSIGNED NULL AFTER `void_reason`');
CALL mta_add_column('attendance_adjustments','voided_at','DATETIME NULL AFTER `voided_by`');
CALL mta_add_column('attendance_adjustments','replacement_adjustment_id','BIGINT UNSIGNED NULL AFTER `voided_at`');
CALL mta_add_column('attendance_adjustments','version','INT UNSIGNED NOT NULL DEFAULT 1 AFTER `replacement_adjustment_id`');
CALL mta_add_index('attendance_adjustments','uq_attendance_adjustment_replacement','UNIQUE KEY `uq_attendance_adjustment_replacement` (`replacement_adjustment_id`)');
CALL mta_add_constraint('attendance_adjustments','fk_attendance_adjustments_voided_by','FOREIGN KEY (`voided_by`) REFERENCES `users`(`id`) ON DELETE SET NULL');
CALL mta_add_constraint('attendance_adjustments','fk_attendance_adjustments_replacement','FOREIGN KEY (`replacement_adjustment_id`) REFERENCES `attendance_adjustments`(`id`) ON DELETE SET NULL');

CALL mta_add_column('formation_fund_entries','corrected_from_id','BIGINT UNSIGNED NULL AFTER `voided_at`');
CALL mta_add_index('formation_fund_entries','uq_formation_correction_once','UNIQUE KEY `uq_formation_correction_once` (`corrected_from_id`)');
CALL mta_add_constraint('formation_fund_entries','fk_formation_corrected_from','FOREIGN KEY (`corrected_from_id`) REFERENCES `formation_fund_entries`(`id`) ON DELETE SET NULL');

CALL mta_add_column('social_profit_entries','corrected_from_id','BIGINT UNSIGNED NULL AFTER `voided_at`');
CALL mta_add_index('social_profit_entries','uq_social_profit_correction_once','UNIQUE KEY `uq_social_profit_correction_once` (`corrected_from_id`)');
CALL mta_add_constraint('social_profit_entries','fk_social_profit_corrected_from','FOREIGN KEY (`corrected_from_id`) REFERENCES `social_profit_entries`(`id`) ON DELETE SET NULL');

DROP PROCEDURE IF EXISTS mta_add_constraint;
DROP PROCEDURE IF EXISTS mta_add_index;
DROP PROCEDURE IF EXISTS mta_add_column;
