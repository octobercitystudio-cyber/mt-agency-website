SET NAMES utf8mb4;

-- Allows exact minute-based studio consumption. One minute is stored as
-- 0.0167 hour instead of being rounded to two decimal places.
ALTER TABLE client_packages
  MODIFY purchased_quantity DECIMAL(12,4) NOT NULL,
  MODIFY held_quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  MODIFY consumed_quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  MODIFY payment_due_quantity DECIMAL(12,4) NOT NULL DEFAULT 0;

ALTER TABLE package_usage_ledger
  MODIFY quantity DECIMAL(12,4) NOT NULL;

ALTER TABLE bookings
  MODIFY requested_quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  MODIFY actual_hours DECIMAL(12,4) NOT NULL DEFAULT 0,
  MODIFY billable_quantity DECIMAL(12,4) NOT NULL DEFAULT 0,
  MODIFY overage_quantity DECIMAL(12,4) NOT NULL DEFAULT 0;

ALTER TABLE booking_sessions
  MODIFY billable_quantity DECIMAL(12,4) NOT NULL DEFAULT 0;
