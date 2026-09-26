# Remembered login

Customer and staff password logins remember the current device automatically.
Existing signed-in devices are enrolled when `/auth/session` restores the account.
Passwords are never persisted in browser storage or cookies.

- Two random credentials are held in Secure, HttpOnly, SameSite=Strict, host-only
  cookies. Only their SHA-256 hashes are stored on the server.
- Device credentials expire after 90 days without renewal (configurable downward
  with `app.remember_device_days`). Restoring the account renews this period.
- Normal API sessions retain the seven-day maximum, two-hour idle timeout and
  user-agent binding. A remembered device can transparently create a fresh short
  session. The renewed session token is derived from both device secrets and a
  server generation counter; row locking makes simultaneous restores idempotent.
- Logout revokes the current device and its associated session. Password changes,
  client session revocation and disabling a client account invalidate remembered
  credentials through the existing credential version and active-account checks.
- Remembered devices are capped by `max_sessions_per_user` (default five). Oldest
  devices and their associated sessions are evicted when this cap is reached.
- Clearing app/browser data, explicit logout, changed browser identity or expired
  device credentials requires another sign-in. This applies to each browser/app
  cookie store independently; no Android rebuild is required for this change.
- Device credentials are excluded from application data exports.

Schema: `database/mysql/049_remembered_login_devices.sql`. Runtime installation
uses the same idempotent table definition, outside business transactions.
The health endpoint reports `remembered_login_ready` without credential details.

Verification: `tests/rememberedLogin.test.php` exercises real session restoration,
expiry, device binding, revocation, role isolation and device limits against an
isolated SQLite adapter; no production accounts or credentials are required.
