import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SYSTEM_BACKUP_CONFIRMATION, readSystemBackupFile, systemBackupFilename, validateSystemBackupDocument } from '../src/erp/systemBackupFile.js';

const sampleBackup = {
  format: 'mt-agency-system-backup',
  version: 1,
  exported_at: '2026-09-13T20:30:00+03:00',
  organization_id: 1,
  organization_name: 'Multi Task Agency',
  row_count: 3,
  tables: {
    organizations: [{ id: 1, name: 'Multi Task Agency' }],
    users: [{ id: 1, role: 'owner' }],
    clients: [{ id: 10, organization_id: 1, name: 'شريف عثمان' }],
  },
  checksum: `sha256:${'a'.repeat(64)}`,
};

test('backup file contract validates the portable document and presents its real row totals', async () => {
  const summary = validateSystemBackupDocument(sampleBackup);
  assert.equal(summary.organizationName, 'Multi Task Agency');
  assert.equal(summary.tableCount, 3);
  assert.equal(summary.rowCount, 3);
  assert.match(systemBackupFilename(sampleBackup), /^نسخة-بيانات-البرنامج-2026-09-13T20-30-00\+03-00\.json$/);

  const file = { name: 'backup.json', size: 500, text: async () => JSON.stringify(sampleBackup) };
  assert.equal((await readSystemBackupFile(file)).summary.rowCount, 3);
  await assert.rejects(() => readSystemBackupFile({ ...file, name: 'backup.txt' }), /JSON/);
  assert.throws(() => validateSystemBackupDocument({ ...sampleBackup, checksum: 'broken' }), /بصمة/);
});

test('owner settings and production API expose a complete guarded backup and restore workflow', async () => {
  const [settings, styles, api] = await Promise.all([
    readFile(new URL('../src/erp/ERPSettings.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/erp/ERPSettingsBackup.css', import.meta.url), 'utf8'),
    readFile(new URL('../api/index.php', import.meta.url), 'utf8'),
  ]);
  assert.equal(SYSTEM_BACKUP_CONFIRMATION, 'استعادة البيانات');
  assert.match(settings, /\/system-backups\/export/);
  assert.match(settings, /\/system-backups\/restore/);
  assert.match(settings, /new FormData\(\)/);
  assert.match(settings, /نسخة-قبل-الاستعادة/);
  assert.match(settings, /احتفظ بملف النسخة في مكان آمن/);
  assert.match(settings, /ملفات إثبات الدفع نفسها تُحمى ضمن نسخة Hostinger/);
  assert.doesNotMatch(settings, /Supabase/);
  assert.match(styles, /system-backup-action--restore/);
  assert.match(styles, /@media\(max-width:700px\)/);

  assert.match(api, /systemBackupDirectTables/);
  assert.match(api, /systemBackupChildQueries/);
  assert.match(api, /'api_sessions','auth_rate_limits','password_reset_tokens'/);
  assert.match(api, /requireRole\(\$user,\['owner'\]\)/);
  assert.match(api, /backup_checksum_mismatch/);
  assert.match(api, /backup_organization_mismatch/);
  assert.match(api, /current_owner_preserved/);
  assert.match(api, /SET FOREIGN_KEY_CHECKS=0/);
  assert.match(api, /SET FOREIGN_KEY_CHECKS=1/);
  assert.match(api, /restore_system_backup/);
  assert.match(api, /export_system_backup/);
});
