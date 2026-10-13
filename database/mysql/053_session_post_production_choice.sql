-- Existing sessions retain automatic editing. Only an explicit staff choice opts out.
ALTER TABLE booking_sessions ADD COLUMN IF NOT EXISTS exclude_from_post_production TINYINT(1) NOT NULL DEFAULT 0;
