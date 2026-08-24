import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('client linkage is the authoritative authorization boundary', async () => {
  const api = await load('api/index.php');
  assert.match(api, /function authorizationRole\(array \$row\): string/);
  assert.match(api, /\$row\['client_id'\] !== null\s*\? 'client'/);
  assert.match(api, /\$user\['role'\] = authorizationRole\(\$user\)/);
  assert.match(api, /\$found\['role'\] = authorizationRole\(\$found\)/);
  assert.match(api, /'role'=>authorizationRole\(\$row\)/);
});

test('database prevents a client-linked account from receiving an ERP role', async () => {
  const migration = await load('database/mysql/033_user_role_separation.sql');
  assert.match(migration, /DELETE s[\s\S]*FROM api_sessions/);
  assert.match(migration, /SET u\.role = 'client'/);
  assert.match(migration, /role = 'owner' AND client_id IS NULL AND is_active = 1/);
  assert.match(migration, /CREATE TRIGGER mta_users_client_role_bi/);
  assert.match(migration, /CREATE TRIGGER mta_users_client_role_bu/);
  assert.match(migration, /SET NEW\.role = IF\(NEW\.client_id IS NOT NULL, 'client', NEW\.role\)/);
});

test('settings identify client accounts without an editable owner selector', async () => {
  const ui = await load('src/erp/ERPSettings.jsx');
  assert.match(ui, /client: \{ label: 'عميل'/);
  assert.match(ui, /SYSTEM_ROLES/);
  assert.match(ui, /u\.role === 'client' \|\| Boolean\(u\.client_id\)/);
  assert.match(ui, /يُدار من ملف العميل/);
});
