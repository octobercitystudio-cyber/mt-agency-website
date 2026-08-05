SET NAMES utf8mb4;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'public_title_en'),
  'SELECT 1',
  'ALTER TABLE promotions ADD COLUMN public_title_en VARCHAR(180) NULL AFTER public_title'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'badge_en'),
  'SELECT 1',
  'ALTER TABLE promotions ADD COLUMN badge_en VARCHAR(60) NULL AFTER badge'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'description_en'),
  'SELECT 1',
  'ALTER TABLE promotions ADD COLUMN description_en TEXT NULL AFTER description'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'discount_text_en'),
  'SELECT 1',
  'ALTER TABLE promotions ADD COLUMN discount_text_en VARCHAR(100) NULL AFTER discount_text'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;

SET @ddl = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'promotions' AND column_name = 'cta_label_en'),
  'SELECT 1',
  'ALTER TABLE promotions ADD COLUMN cta_label_en VARCHAR(80) NULL AFTER cta_label'
);
PREPARE statement FROM @ddl; EXECUTE statement; DEALLOCATE PREPARE statement;
