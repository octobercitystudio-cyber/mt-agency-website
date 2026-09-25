-- New reset links have no deadline. Existing deadlines and used/revoked state are preserved.
ALTER TABLE password_reset_tokens MODIFY COLUMN expires_at DATETIME NULL DEFAULT NULL;
