import initSqlJs from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { extractLegacyPackageRows } from './legacySqlitePackages.js';

const REQUIRED_SOURCE_COLUMNS = {
  clients: ['id', 'name', 'phone1', 'phone2'],
  services: ['id', 'name', 'price', 'validity_days', 'total_hours', 'payment_due_hours', 'total_reels'],
  bookings: ['id', 'client_name', 'service', 'date', 'status', 'actual_hours', 'payment', 'custom_price', 'custom_expiry', 'actual_reels'],
};

const SOURCE_SELECTS = {
  clients: 'SELECT id,name,phone1,phone2 FROM clients',
  services: 'SELECT id,name,price,validity_days,total_hours,payment_due_hours,total_reels FROM services',
  bookings: 'SELECT id,client_name,service,date,status,actual_hours,payment,custom_price,custom_expiry,actual_reels FROM bookings',
};

const bytesToHex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const rowsFromResult = result => {
  const first = result[0];
  if (!first) return [];
  return first.values.map(values => Object.fromEntries(first.columns.map((column, index) => [column, values[index]])));
};

export async function parseLegacySqlitePackageFile(file, { asOfDate = new Date().toISOString().slice(0, 10) } = {}) {
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
      if (missing.length) throw new Error(`النسخة القديمة لا تحتوي الحقول المطلوبة للباقات في ${table}.`);
    }

    // Privacy boundary: no values are read from finance, users, reminders, or any other old table.
    const clients = rowsFromResult(database.exec(SOURCE_SELECTS.clients));
    const services = rowsFromResult(database.exec(SOURCE_SELECTS.services));
    const bookings = rowsFromResult(database.exec(SOURCE_SELECTS.bookings));
    const extracted = extractLegacyPackageRows({ clients, services, bookings, sourceFingerprint, asOfDate });
    return {
      manifest_version: 1,
      source: {
        kind: 'legacy_sqlite_packages_only',
        filename: file.name,
        sha256: sourceFingerprint,
        tables_read: Object.keys(SOURCE_SELECTS),
      },
      ...extracted,
    };
  } finally {
    database.close();
  }
}

export { REQUIRED_SOURCE_COLUMNS, SOURCE_SELECTS };
