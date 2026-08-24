-- Enforce the security boundary between client portal accounts and ERP accounts.
-- Existing credentials and client/business data are preserved.

SET @schema_name = DATABASE();

-- Revoke any session that was issued while a client-linked account had a
-- privileged role, but only in organizations that retain an active true owner.
DROP TEMPORARY TABLE IF EXISTS mta_033_safe_organizations;
CREATE TEMPORARY TABLE mta_033_safe_organizations (
  organization_id BIGINT UNSIGNED PRIMARY KEY
) ENGINE=MEMORY;
INSERT INTO mta_033_safe_organizations (organization_id)
SELECT organization_id
FROM users
WHERE role = 'owner' AND client_id IS NULL AND is_active = 1
GROUP BY organization_id;

DELETE s
FROM api_sessions s
JOIN users u ON u.id = s.user_id
JOIN mta_033_safe_organizations safe_org ON safe_org.organization_id = u.organization_id
WHERE u.client_id IS NOT NULL AND u.role <> 'client';

UPDATE users u
JOIN mta_033_safe_organizations safe_org ON safe_org.organization_id = u.organization_id
SET u.role = 'client', u.credential_version = u.credential_version + 1
WHERE u.client_id IS NOT NULL AND u.role <> 'client';

DROP TEMPORARY TABLE mta_033_safe_organizations;

-- MariaDB does not permit a CHECK constraint on this foreign-key column.
-- These one-statement triggers are repeatable and force the least-privileged
-- client role whenever a client link exists.
DROP TRIGGER IF EXISTS mta_users_client_role_bi;
CREATE TRIGGER mta_users_client_role_bi
BEFORE INSERT ON users
FOR EACH ROW
SET NEW.role = IF(NEW.client_id IS NOT NULL, 'client', NEW.role);

DROP TRIGGER IF EXISTS mta_users_client_role_bu;
CREATE TRIGGER mta_users_client_role_bu
BEFORE UPDATE ON users
FOR EACH ROW
SET NEW.role = IF(NEW.client_id IS NOT NULL, 'client', NEW.role);
