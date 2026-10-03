CREATE TABLE IF NOT EXISTS site_analytics_events (
 event_id CHAR(36) NOT NULL PRIMARY KEY,
 organization_id BIGINT UNSIGNED NOT NULL,
 visitor_key CHAR(64) NOT NULL,
 session_key CHAR(64) NOT NULL,
 event_name VARCHAR(64) NOT NULL,
 page_path VARCHAR(150) NOT NULL,
 screen VARCHAR(40) NOT NULL DEFAULT '',
 control VARCHAR(16) NOT NULL DEFAULT '',
 platform VARCHAR(16) NOT NULL,
 device VARCHAR(16) NOT NULL,
 source VARCHAR(16) NOT NULL,
 created_at DATETIME NOT NULL,
 INDEX idx_analytics_org_date (organization_id,created_at),
 INDEX idx_analytics_org_event_date (organization_id,event_name,created_at),
 INDEX idx_analytics_org_session (organization_id,session_key,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
