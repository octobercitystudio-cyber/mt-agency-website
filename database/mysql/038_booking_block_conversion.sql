-- Durable, retry-safe conversion of an operational calendar block into a client booking.
SET @mta_schema := DATABASE();

DROP PROCEDURE IF EXISTS mta_038_add_column;
DELIMITER $$
CREATE PROCEDURE mta_038_add_column(IN table_name_value VARCHAR(64), IN column_name_value VARCHAR(64), IN definition_value TEXT)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @mta_schema AND TABLE_NAME = table_name_value AND COLUMN_NAME = column_name_value
  ) THEN
    SET @ddl := CONCAT('ALTER TABLE `', table_name_value, '` ADD COLUMN `', column_name_value, '` ', definition_value);
    PREPARE statement_value FROM @ddl; EXECUTE statement_value; DEALLOCATE PREPARE statement_value;
  END IF;
END$$
DELIMITER ;

CALL mta_038_add_column('booking_blocks','converted_booking_id','BIGINT UNSIGNED NULL AFTER `status`');
CALL mta_038_add_column('booking_blocks','conversion_idempotency_key','VARCHAR(160) NULL AFTER `converted_booking_id`');
CALL mta_038_add_column('booking_blocks','conversion_request_hash','CHAR(64) NULL AFTER `conversion_idempotency_key`');
CALL mta_038_add_column('booking_blocks','conversion_response_json','JSON NULL AFTER `conversion_request_hash`');
DROP PROCEDURE IF EXISTS mta_038_add_column;

SET @ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@mta_schema AND TABLE_NAME='booking_blocks' AND INDEX_NAME='uq_booking_blocks_conversion_key'),
  'SELECT 1',
  'ALTER TABLE booking_blocks ADD UNIQUE KEY uq_booking_blocks_conversion_key (organization_id,conversion_idempotency_key)'
); PREPARE statement_value FROM @ddl; EXECUTE statement_value; DEALLOCATE PREPARE statement_value;

SET @ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=@mta_schema AND TABLE_NAME='booking_blocks' AND INDEX_NAME='uq_booking_blocks_converted_booking'),
  'SELECT 1',
  'ALTER TABLE booking_blocks ADD UNIQUE KEY uq_booking_blocks_converted_booking (converted_booking_id)'
); PREPARE statement_value FROM @ddl; EXECUTE statement_value; DEALLOCATE PREPARE statement_value;

SET @ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@mta_schema AND TABLE_NAME='booking_blocks' AND CONSTRAINT_NAME='fk_booking_blocks_converted_booking'),
  'SELECT 1',
  'ALTER TABLE booking_blocks ADD CONSTRAINT fk_booking_blocks_converted_booking FOREIGN KEY (converted_booking_id) REFERENCES bookings(id) ON DELETE SET NULL'
); PREPARE statement_value FROM @ddl; EXECUTE statement_value; DEALLOCATE PREPARE statement_value;
