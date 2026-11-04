-- Explicit opt-in migration. Never executed automatically by HTTP requests.
SET NAMES utf8mb4;
CREATE TABLE IF NOT EXISTS article_categories (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 slug VARCHAR(160) NOT NULL,
 name_ar VARCHAR(160) NOT NULL,
 name_en VARCHAR(160) NOT NULL,
 description_ar TEXT NOT NULL,
 description_en TEXT NOT NULL,
 service_slug VARCHAR(100) NOT NULL DEFAULT '',
 UNIQUE KEY uq_article_category_slug (organization_id,slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS articles (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 author_name VARCHAR(160) NOT NULL,
 category_id BIGINT UNSIGNED NULL,
 service_slug VARCHAR(100) NOT NULL DEFAULT '',
 featured TINYINT NOT NULL DEFAULT 0,
 version INT NOT NULL DEFAULT 1,
 deleted_at DATETIME NULL,
 created_at DATETIME NOT NULL,
 updated_at DATETIME NOT NULL,
 KEY idx_articles_org (organization_id,deleted_at),
 CONSTRAINT fk_article_category FOREIGN KEY (category_id) REFERENCES article_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS article_translations (
 article_id BIGINT UNSIGNED NOT NULL,
 locale CHAR(2) NOT NULL,
 title VARCHAR(220) NOT NULL,
 slug VARCHAR(160) NOT NULL,
 excerpt TEXT NOT NULL,
 blocks LONGTEXT NOT NULL,
 seo_title VARCHAR(220) NOT NULL,
 seo_description VARCHAR(320) NOT NULL,
 cover_url VARCHAR(600) NOT NULL,
 cover_alt VARCHAR(300) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'draft',
 scheduled_at DATETIME NULL,
 published_at DATETIME NULL,
 updated_at DATETIME NOT NULL,
 PRIMARY KEY (article_id,locale),
 KEY idx_article_publication (locale,status,scheduled_at,published_at),
 CONSTRAINT fk_article_translation FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Permanent route reservations point to an article, never another redirect.
CREATE TABLE IF NOT EXISTS article_routes (
 organization_id BIGINT UNSIGNED NOT NULL,
 locale CHAR(2) NOT NULL,
 slug VARCHAR(160) NOT NULL,
 article_id BIGINT UNSIGNED NOT NULL,
 PRIMARY KEY (organization_id,locale,slug),
 CONSTRAINT fk_article_route FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS article_media (
 id CHAR(32) PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 filename VARCHAR(80) NOT NULL,
 mime VARCHAR(80) NOT NULL,
 width INT NOT NULL DEFAULT 0,
 height INT NOT NULL DEFAULT 0,
 created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS article_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 actor_id BIGINT UNSIGNED NOT NULL,
 article_id BIGINT UNSIGNED NULL,
 action VARCHAR(32) NOT NULL,
 created_at DATETIME NOT NULL,
 KEY idx_article_audit (organization_id,article_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial categories only; no articles are published by this migration.
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'media-production','الإنتاج الإعلامي','Media production','تخطيط وإنتاج الفيديو للشركات.','Planning and producing business video.','commercial-video-production' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'filming-equipment','التصوير والكاميرات والمعدات','Filming, cameras & equipment','اختيار تجهيزات مناسبة لهدف التصوير.','Choosing equipment for the filming goal.','studio-content-production' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'editing-content','المونتاج وصناعة المحتوى','Editing & content creation','تحويل المادة المصورة إلى محتوى قابل للنشر.','Turning footage into content ready to publish.','creative-design-branding' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'social-media','إدارة السوشيال ميديا','Social media management','التخطيط للمحتوى والنشر والمتابعة.','Content planning, publishing and reporting.','social-media-management' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'events','تغطية المعارض والمؤتمرات والفعاليات','Exhibitions, conferences & events','التحضير لتغطية الفعاليات ومخرجاتها.','Preparing event coverage and deliverables.','event-coverage' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'podcasts','البودكاست','Podcasts','تخطيط وتسجيل وتحرير حلقات البودكاست.','Planning, recording and editing podcasts.','podcast-production' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
INSERT INTO article_categories (organization_id,slug,name_ar,name_en,description_ar,description_en,service_slug) SELECT id,'customer-guides','أدلة وأسئلة العملاء','Client guides & questions','إجابات تساعد على اختيار الخدمة والتجهيز لها.','Answers to help choose and prepare for a service.','' FROM organizations ON DUPLICATE KEY UPDATE slug=VALUES(slug);
