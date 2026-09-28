-- The API also installs these columns before accepting delivery operations.
SET @delivery_pin_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='video_delivery_links' AND column_name='is_pinned'), 'SELECT 1', 'ALTER TABLE video_delivery_links ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0');
PREPARE delivery_pin_stmt FROM @delivery_pin_ddl;
EXECUTE delivery_pin_stmt;
DEALLOCATE PREPARE delivery_pin_stmt;
SET @delivery_publish_ddl = IF(EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='video_delivery_links' AND column_name='published_at'), 'SELECT 1', 'ALTER TABLE video_delivery_links ADD COLUMN published_at DATETIME NULL');
PREPARE delivery_publish_stmt FROM @delivery_publish_ddl;
EXECUTE delivery_publish_stmt;
DEALLOCATE PREPARE delivery_publish_stmt;
-- Preserve the original deadline for existing published deliveries.
UPDATE video_delivery_links l
JOIN post_production_jobs j ON j.id=l.post_production_job_id AND j.organization_id=l.organization_id
SET l.published_at=l.created_at
WHERE l.published_at IS NULL AND l.is_active=1 AND j.status IN ('upload_completed','delivered');
