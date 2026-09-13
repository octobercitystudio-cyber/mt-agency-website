export const SYSTEM_BACKUP_FORMAT = 'mt-agency-system-backup';
export const SYSTEM_BACKUP_VERSION = 1;
export const SYSTEM_BACKUP_CONFIRMATION = 'استعادة البيانات';
export const MAX_SYSTEM_BACKUP_BYTES = 50 * 1024 * 1024;

const safeDatePart = value => String(value || new Date().toISOString())
  .replace(/[:.]/g, '-')
  .replace(/[^0-9TZ+-]/g, '_');

export const systemBackupFilename = (backup, prefix = 'نسخة-بيانات-البرنامج') => (
  `${prefix}-${safeDatePart(backup?.exported_at)}.json`
);

export const validateSystemBackupDocument = backup => {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) throw new Error('محتوى ملف النسخة غير صحيح.');
  if (backup.format !== SYSTEM_BACKUP_FORMAT || Number(backup.version) !== SYSTEM_BACKUP_VERSION) throw new Error('ملف النسخة الاحتياطية غير مدعوم.');
  if (!backup.tables || typeof backup.tables !== 'object' || Array.isArray(backup.tables)) throw new Error('ملف النسخة لا يحتوي على جداول البيانات.');
  if (!Array.isArray(backup.tables.organizations) || !Array.isArray(backup.tables.users)) throw new Error('ملف النسخة لا يحتوي على بيانات النظام الأساسية.');
  if (!/^sha256:[a-f0-9]{64}$/.test(String(backup.checksum || ''))) throw new Error('ملف النسخة لا يحتوي على بصمة تحقق صالحة.');
  const tableEntries = Object.entries(backup.tables);
  const rowCount = tableEntries.reduce((sum, [, rows]) => {
    if (!Array.isArray(rows)) throw new Error('تركيب أحد جداول النسخة غير صحيح.');
    return sum + rows.length;
  }, 0);
  if (rowCount < 1 || rowCount > 250000) throw new Error('عدد السجلات في النسخة خارج النطاق المسموح.');
  return {
    exportedAt: String(backup.exported_at || ''),
    organizationName: String(backup.organization_name || ''),
    tableCount: tableEntries.length,
    rowCount,
    checksum: String(backup.checksum),
  };
};

export const readSystemBackupFile = async file => {
  if (!file) throw new Error('اختر ملف النسخة الاحتياطية أولًا.');
  if (!String(file.name || '').toLowerCase().endsWith('.json')) throw new Error('استخدم ملف نسخة بصيغة JSON.');
  if (Number(file.size || 0) < 20 || Number(file.size || 0) > MAX_SYSTEM_BACKUP_BYTES) throw new Error('حجم ملف النسخة يجب ألا يتجاوز 50 ميجابايت.');
  let backup;
  try { backup = JSON.parse(await file.text()); }
  catch { throw new Error('تعذر قراءة ملف النسخة؛ تأكد أنه ملف JSON سليم.'); }
  return { backup, summary: validateSystemBackupDocument(backup) };
};

export const downloadSystemBackup = (backup, prefix) => {
  validateSystemBackupDocument(backup);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = systemBackupFilename(backup, prefix);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};
