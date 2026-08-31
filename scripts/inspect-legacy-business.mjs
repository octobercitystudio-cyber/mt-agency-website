import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { extractLegacyOperationalData } from '../src/lib/legacyOperationalImport.js';
const SOURCE_SELECTS = {
  clients:'SELECT id,name,phone1,phone2,job,notif_hours,debt,credit,points,points_updated_at,color FROM clients',
  services:'SELECT id,name,type,price,deposit,validity_days,description,total_hours,payment_due_hours,total_reels,category FROM services',
  bookings:'SELECT id,client_name,service,date,status,start_time,end_time,actual_hours,payment,notes,delivery_date,custom_price,custom_expiry,discount,discount_reason,actual_reels FROM bookings',
  finance:'SELECT id,type,amount,method,detail,date,entity FROM finance',
  reminders:'SELECT id,title,type,due_date,notify_before,is_recurring,status,amount FROM reminders',
  app_config:'SELECT `key`,value FROM app_config',
};

const [databasePath] = process.argv.slice(2);
if (!databasePath) throw new Error('Usage: node scripts/inspect-legacy-business.mjs <old.db>');
const absoluteDatabasePath = path.resolve(databasePath);
const bytes = await fs.readFile(absoluteDatabasePath);
if (bytes.subarray(0,16).toString('ascii') !== 'SQLite format 3\0') throw new Error('Not a SQLite database.');
const sourceFingerprint = createHash('sha256').update(bytes).digest('hex');
const database = await new Promise((resolve,reject) => { const instance = new sqlite3.Database(absoluteDatabasePath,sqlite3.OPEN_READONLY,error => error ? reject(error) : resolve(instance)); });
const all = sql => new Promise((resolve,reject) => database.all(sql,[],(error,rows) => error ? reject(error) : resolve(rows)));
try {
  const sourceRows = Object.fromEntries(await Promise.all(Object.entries(SOURCE_SELECTS).map(async ([table,sql]) => [table,await all(sql)])));
  sourceRows.app_config = sourceRows.app_config.filter(row => /^(?:points_|partner_.*_adj)/u.test(String(row.key || '')));
  const manifest = extractLegacyOperationalData({ ...sourceRows,sourceFingerprint,asOfDate:'2026-08-31' });
  const packageByReference = new Map(manifest.packages.map(row => [row.legacy_reference, row]));
  const upcomingHolds = new Map();
  manifest.appointments.filter(row => row.status === 'confirmed' && row.date >= '2026-08-31' && row.package_reference).forEach(row => upcomingHolds.set(row.package_reference, (upcomingHolds.get(row.package_reference) || 0) + row.requested_quantity));
  const holdWarnings = [...upcomingHolds].flatMap(([reference, held]) => {
    const pkg = packageByReference.get(reference); const available = Math.max(0, Number(pkg?.purchased_quantity || 0) - Number(pkg?.consumed_quantity || 0));
    return held > available + 0.0001 ? [{ reference, held, available }] : [];
  });
  console.log(JSON.stringify({ source_sha256:sourceFingerprint,estimated_request_bytes:Buffer.byteLength(JSON.stringify({ ...manifest,source_archive:sourceRows })) ,summary:manifest.summary,warnings:manifest.warnings,upcoming_package_holds:[...upcomingHolds].map(([reference,held]) => ({ reference,held })),hold_warnings:holdWarnings,package_statuses:Object.fromEntries(Object.entries(Object.groupBy(manifest.packages,row => row.status)).map(([key,rows]) => [key,rows.length])),finance_kinds:Object.fromEntries(Object.entries(Object.groupBy(manifest.finance_entries,row => row.entry_kind)).map(([key,rows]) => [key,rows.length])) },null,2));
} finally { await new Promise(resolve => database.close(resolve)); }
