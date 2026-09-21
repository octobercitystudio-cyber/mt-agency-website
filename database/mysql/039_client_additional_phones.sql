-- Preserve legacy phone2; clients without a list keep using it until their next edit.
SET @mta_client_phones_ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clients' AND COLUMN_NAME='additional_phones'),
  'SELECT 1',
  'ALTER TABLE clients ADD COLUMN additional_phones JSON NULL AFTER phone2'
);
PREPARE mta_client_phones_statement FROM @mta_client_phones_ddl;
EXECUTE mta_client_phones_statement;
DEALLOCATE PREPARE mta_client_phones_statement;
