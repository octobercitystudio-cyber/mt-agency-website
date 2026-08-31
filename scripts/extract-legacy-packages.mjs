import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { extractLegacyPackageRows } from '../src/lib/legacySqlitePackages.js';

const [databasePath, requestedOutput] = process.argv.slice(2);
if (!databasePath) throw new Error('Usage: node scripts/extract-legacy-packages.mjs <old.db> [output.json]');
const absoluteDatabasePath = path.resolve(databasePath);
const outputPath = path.resolve(requestedOutput || path.join('outputs', 'legacy-package-db-import', 'legacy-packages.json'));
const fileBytes = await fs.readFile(absoluteDatabasePath);
if (fileBytes.subarray(0, 16).toString('ascii') !== 'SQLite format 3\0') throw new Error('The source file is not a SQLite database.');
const sourceFingerprint = createHash('sha256').update(fileBytes).digest('hex');
const database = await new Promise((resolve, reject) => {
  const instance = new sqlite3.Database(absoluteDatabasePath, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(instance));
});
const all = (sql, parameters = []) => new Promise((resolve, reject) => database.all(sql, parameters, (error, rows) => error ? reject(error) : resolve(rows)));

try {
  const required = {
    clients: ['id', 'name', 'phone1', 'phone2'],
    services: ['id', 'name', 'price', 'validity_days', 'total_hours', 'payment_due_hours', 'total_reels'],
    bookings: ['id', 'client_name', 'service', 'date', 'status', 'actual_hours', 'payment', 'custom_price', 'custom_expiry', 'actual_reels'],
  };
  for (const [table, columns] of Object.entries(required)) {
    const found = await all(`PRAGMA table_info("${table}")`); const names = new Set(found.map(column => column.name));
    const missing = columns.filter(column => !names.has(column));
    if (missing.length) throw new Error(`Missing required source fields in ${table}: ${missing.join(', ')}`);
  }
  // Deliberately read only the three source tables needed to reconstruct sold packages.
  const [clients, services, bookings] = await Promise.all([
    all('SELECT id,name,phone1,phone2 FROM clients'),
    all('SELECT id,name,price,validity_days,total_hours,payment_due_hours,total_reels FROM services'),
    all('SELECT id,client_name,service,date,status,actual_hours,payment,custom_price,custom_expiry,actual_reels FROM bookings'),
  ]);
  const extracted = extractLegacyPackageRows({ clients, services, bookings, sourceFingerprint, asOfDate: '2026-08-31' });
  const manifest = {
    manifest_version: 1,
    source: { kind: 'legacy_sqlite_packages_only', sha256: sourceFingerprint, extracted_at: new Date().toISOString(), tables_read: ['clients', 'services', 'bookings'] },
    ...extracted,
  };
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: outputPath, source_sha256: sourceFingerprint, summary: manifest.summary, warnings: manifest.warnings.length }, null, 2));
} finally {
  await new Promise(resolve => database.close(resolve));
}
