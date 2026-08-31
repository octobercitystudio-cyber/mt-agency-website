import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { extractLegacyOperationalData } from './legacyOperationalImport.js';

const REQUIRED_SOURCE_COLUMNS = {
  clients: ['id', 'name', 'phone1', 'phone2', 'job', 'notif_hours', 'debt', 'credit', 'points', 'points_updated_at', 'color'],
  services: ['id', 'name', 'type', 'price', 'deposit', 'validity_days', 'description', 'total_hours', 'payment_due_hours', 'total_reels', 'category'],
  bookings: ['id', 'client_name', 'service', 'date', 'status', 'start_time', 'end_time', 'actual_hours', 'payment', 'notes', 'delivery_date', 'custom_price', 'custom_expiry', 'discount', 'discount_reason', 'actual_reels'],
  finance: ['id', 'type', 'amount', 'method', 'detail', 'date', 'entity'],
  reminders: ['id', 'title', 'type', 'due_date', 'notify_before', 'is_recurring', 'status', 'amount'],
  app_config: ['key', 'value'],
};

const SOURCE_SELECTS = {
  clients: 'SELECT id,name,phone1,phone2,job,notif_hours,debt,credit,points,points_updated_at,color FROM clients',
  services: 'SELECT id,name,type,price,deposit,validity_days,description,total_hours,payment_due_hours,total_reels,category FROM services',
  bookings: 'SELECT id,client_name,service,date,status,start_time,end_time,actual_hours,payment,notes,delivery_date,custom_price,custom_expiry,discount,discount_reason,actual_reels FROM bookings',
  finance: 'SELECT id,type,amount,method,detail,date,entity FROM finance',
  reminders: 'SELECT id,title,type,due_date,notify_before,is_recurring,status,amount FROM reminders',
  app_config: 'SELECT `key`,value FROM app_config',
};

const bytesToHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const rowsFromResult = result => {
  const first = result[0];
  if (!first) return [];
  return first.values.map(values => Object.fromEntries(first.columns.map((column, index) => [column, values[index]])));
};

export async function parseLegacySqliteBusinessFile(file, { asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
  if (!(file instanceof File)) throw new Error('اختر ملف قاعدة بيانات البرنامج القديم.');
  if (file.size <= 0 || file.size > 20 * 1024 * 1024) throw new Error('حجم ملف النسخة القديمة غير صالح أو يتجاوز 20 ميجابايت.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder('ascii').decode(bytes.slice(0, 16));
  if (signature !== 'SQLite format 3\0') throw new Error('الملف المختار ليس قاعدة بيانات صالحة من البرنامج القديم.');

  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const sourceFingerprint = bytesToHex(new Uint8Array(digest));
  const SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const database = new SQL.Database(bytes);
  try {
    for (const [table, requiredColumns] of Object.entries(REQUIRED_SOURCE_COLUMNS)) {
      const columns = rowsFromResult(database.exec(`PRAGMA table_info("${table}")`));
      const available = new Set(columns.map(column => String(column.name)));
      const missing = requiredColumns.filter(column => !available.has(column));
      if (missing.length) throw new Error(`النسخة القديمة لا تحتوي الحقول المطلوبة للنقل في ${table}.`);
    }

    // Explicit allow-list: user accounts, passwords, dismissed notifications,
    // backup settings and every other table/column stay outside the import.
    const sourceRows = Object.fromEntries(Object.entries(SOURCE_SELECTS).map(([table, sql]) => [table, rowsFromResult(database.exec(sql))]));
    sourceRows.app_config = sourceRows.app_config.filter(row => /^(?:points_|partner_.*_adj)/u.test(String(row.key || '')));
    const extracted = extractLegacyOperationalData({ ...sourceRows, sourceFingerprint, asOfDate });
    return {
      manifest_version: 2,
      source: {
        kind: 'legacy_sqlite_business_data',
        filename: file.name,
        sha256: sourceFingerprint,
        tables_read: Object.keys(SOURCE_SELECTS),
        excluded: ['users', 'passwords', 'dismissed_alerts', 'backup settings'],
      },
      source_archive: sourceRows,
      ...extracted,
    };
  } finally {
    database.close();
  }
}

export const parseLegacySqlitePackageFile = parseLegacySqliteBusinessFile;

export { REQUIRED_SOURCE_COLUMNS, SOURCE_SELECTS };
