-- MT Agency: business hours 12 PM through midnight, Egyptian pound.
-- Idempotent migration for existing Hostinger databases.

UPDATE organizations
SET currency = 'EGP', timezone = 'Africa/Cairo'
WHERE id = 1;

ALTER TABLE attendance_policies
  MODIFY scheduled_start TIME NOT NULL DEFAULT '12:00:00',
  MODIFY scheduled_end TIME NOT NULL DEFAULT '24:00:00';

UPDATE attendance_policies
SET scheduled_end = '24:00:00'
WHERE scheduled_end = '22:00:00';
