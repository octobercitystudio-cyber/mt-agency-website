SET @mta_client_source_ddl := IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='clients' AND COLUMN_NAME='registration_source'),
  'SELECT 1',
  'ALTER TABLE clients ADD COLUMN registration_source VARCHAR(20) NOT NULL DEFAULT ''manual'''
);
PREPARE mta_client_source_statement FROM @mta_client_source_ddl;
EXECUTE mta_client_source_statement;
DEALLOCATE PREPARE mta_client_source_statement;
