import sqlite3 from 'sqlite3';
import { parseStrictMoney } from '../../src/lib/strictMoney.js';

const run = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function onRun(error) {
    if (error) reject(error);
    else resolve({ changes: this.changes, lastID: this.lastID });
  });
});

const get = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (error, row) => (error ? reject(error) : resolve(row ?? null)));
});

const all = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows)));
});

const exec = (db, sql) => new Promise((resolve, reject) => {
  db.exec(sql, error => (error ? reject(error) : resolve()));
});

const failure = (code, status = 422) => Object.assign(new Error(code), { code, status });
const requiredMoney = (value, field) => {
  const parsed = parseStrictMoney(value);
  if (!parsed.valid) throw failure('invalid_money_format');
  return { field, cents: parsed.cents, normalized: parsed.normalized };
};
const canonicalize = value => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
};
const requestHash = payload => JSON.stringify(canonicalize(payload));

const tables = [
  'organizations', 'clients', 'services', 'client_packages', 'bookings', 'booking_sessions',
  'package_sale_requests', 'package_usage_ledger', 'payments', 'payment_allocations', 'finance',
  'owner_adjustments', 'audit_logs', 'change_events', 'notifications',
];

export const packageUpgradeFaultStages = [
  'sale_request', 'package', 'ledger', 'payment', 'allocation', 'finance', 'upgrade_audit',
  'source_update', 'adjustment', 'source_audit', 'source_change', 'replacement_change',
  'notification', 'request_complete',
];

export class PackageUpgradeProductionHarness {
  constructor(db) {
    this.db = db;
  }

  static async create() {
    const db = new sqlite3.Database(':memory:');
    const harness = new PackageUpgradeProductionHarness(db);
    await exec(db, `
      PRAGMA foreign_keys = ON;
      CREATE TABLE organizations (id INTEGER PRIMARY KEY);
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id)
      );
      CREATE TABLE services (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        billing_unit TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE client_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        client_id INTEGER NOT NULL REFERENCES clients(id),
        service_id INTEGER NOT NULL REFERENCES services(id),
        name TEXT NOT NULL,
        billing_unit TEXT NOT NULL,
        purchased_minutes INTEGER NOT NULL,
        held_minutes INTEGER NOT NULL DEFAULT 0,
        consumed_minutes INTEGER NOT NULL DEFAULT 0,
        payment_due_minutes INTEGER NOT NULL DEFAULT 0,
        overage_rate_cents INTEGER NOT NULL DEFAULT 0,
        total_cents INTEGER NOT NULL,
        paid_cents INTEGER NOT NULL,
        starts_at TEXT,
        expires_at TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE bookings (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER NOT NULL,
        client_package_id INTEGER NOT NULL REFERENCES client_packages(id),
        status TEXT NOT NULL
      );
      CREATE TABLE booking_sessions (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER NOT NULL,
        booking_id INTEGER NOT NULL REFERENCES bookings(id),
        status TEXT NOT NULL
      );
      CREATE TABLE package_sale_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        response_json TEXT,
        UNIQUE(organization_id, idempotency_key)
      );
      CREATE TABLE package_usage_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        client_package_id INTEGER NOT NULL REFERENCES client_packages(id),
        movement_type TEXT NOT NULL,
        quantity_minutes INTEGER NOT NULL,
        event_key TEXT NOT NULL,
        UNIQUE(organization_id, event_key)
      );
      CREATE TABLE payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        reference TEXT NOT NULL
      );
      CREATE TABLE payment_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        payment_id INTEGER NOT NULL REFERENCES payments(id),
        client_package_id INTEGER NOT NULL REFERENCES client_packages(id),
        amount_cents INTEGER NOT NULL
      );
      CREATE TABLE finance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        amount_cents INTEGER NOT NULL,
        correlation_id TEXT NOT NULL,
        UNIQUE(organization_id, correlation_id)
      );
      CREATE TABLE owner_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        entity_id INTEGER NOT NULL,
        adjustment_type TEXT NOT NULL,
        reason TEXT NOT NULL
      );
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        entity_id INTEGER NOT NULL
      );
      CREATE TABLE change_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        entity_id INTEGER NOT NULL,
        change_type TEXT NOT NULL
      );
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        entity_id INTEGER NOT NULL,
        source_key TEXT NOT NULL,
        UNIQUE(organization_id, source_key)
      );
    `);
    await run(db, 'INSERT INTO organizations(id) VALUES (1), (2)');
    await run(db, 'INSERT INTO clients(id, organization_id) VALUES (11, 1), (12, 1), (22, 2)');
    await run(db, `INSERT INTO services(id, organization_id, billing_unit, active)
      VALUES (101, 1, 'hour', 1), (102, 1, 'hour', 0), (201, 2, 'hour', 1)`);
    await run(db, `INSERT INTO client_packages
      (id, organization_id, client_id, service_id, name, billing_unit, purchased_minutes, held_minutes, consumed_minutes, payment_due_minutes, overage_rate_cents, total_cents, paid_cents, starts_at, expires_at, status, version)
      VALUES
      (301, 1, 11, 101, 'المصدر السليم', 'hour', 600, 0, 180, 300, 140000, 1200000, 20010, '2026-08-01', '2026-09-01', 'active', 1),
      (302, 1, 11, 101, 'المصدر المحجوز', 'hour', 600, 30, 180, 300, 140000, 1200000, 20010, '2026-08-01', '2026-09-01', 'active', 1),
      (303, 1, 11, 101, 'المصدر النشط', 'hour', 600, 0, 180, 300, 140000, 1200000, 20010, '2026-08-01', '2026-09-01', 'active', 1),
      (304, 1, 12, 101, 'مصدر عميل آخر', 'hour', 600, 0, 0, 300, 140000, 1200000, 0, '2026-08-01', '2026-09-01', 'active', 1),
      (320, 2, 22, 201, 'مصدر مؤسسة أخرى', 'hour', 600, 0, 0, 300, 140000, 1200000, 0, '2026-08-01', '2026-09-01', 'active', 1)`);
    await run(db, "INSERT INTO bookings(id, organization_id, client_package_id, status) VALUES (401, 1, 303, 'confirmed')");
    await run(db, "INSERT INTO booking_sessions(id, organization_id, booking_id, status) VALUES (501, 1, 401, 'active')");
    return harness;
  }

  async close() {
    await new Promise((resolve, reject) => this.db.close(error => (error ? reject(error) : resolve())));
  }

  async rows(table) {
    if (!tables.includes(table)) throw failure('unsafe_table');
    return all(this.db, `SELECT * FROM ${table} ORDER BY id`);
  }

  async snapshot() {
    const result = {};
    for (const table of tables) result[table] = await this.rows(table);
    return result;
  }

  async upgrade({ organizationId = 1, role = 'owner', payload, injectFailureAt = '' }) {
    if (role !== 'owner') throw failure('forbidden', 403);
    const total = requiredMoney(payload.total_price, 'total_price');
    const paid = requiredMoney(payload.paid_amount, 'paid_amount');
    const overage = requiredMoney(payload.overage_price_snapshot, 'overage_price_snapshot');
    if (paid.cents > total.cents) throw failure('package_payment_exceeds_total');
    if (!Number.isInteger(payload.quantity) || payload.quantity <= 0) throw failure('invalid_package_quantity');
    if (!Number.isInteger(payload.payment_due_quantity) || payload.payment_due_quantity < 0) throw failure('invalid_payment_due_quantity');
    const purchasedMinutes = payload.quantity * 60;
    const paymentDueMinutes = payload.payment_due_quantity * 60;
    const context = payload.upgrade_context ?? {};
    const hash = requestHash(payload);
    const fault = stage => { if (injectFailureAt === stage) throw failure('injected_failure', 500); };

    await exec(this.db, 'BEGIN IMMEDIATE');
    try {
      const existing = await get(this.db, `SELECT * FROM package_sale_requests
        WHERE organization_id = ? AND idempotency_key = ?`, [organizationId, payload.idempotency_key]);
      if (existing) {
        if (existing.request_hash !== hash) throw failure('idempotency_payload_mismatch', 409);
        if (existing.status !== 'completed') throw failure('idempotency_in_progress', 409);
        await exec(this.db, 'COMMIT');
        return { ...JSON.parse(existing.response_json), idempotent: true };
      }
      const request = await run(this.db, `INSERT INTO package_sale_requests
        (organization_id, idempotency_key, request_hash, status) VALUES (?, ?, ?, 'processing')`,
      [organizationId, payload.idempotency_key, hash]);
      fault('sale_request');

      const client = await get(this.db, 'SELECT * FROM clients WHERE organization_id = ? AND id = ?', [organizationId, payload.client_id]);
      const service = await get(this.db, `SELECT * FROM services
        WHERE organization_id = ? AND id = ? AND active = 1`, [organizationId, payload.service_id]);
      const source = await get(this.db, `SELECT * FROM client_packages
        WHERE organization_id = ? AND id = ?`, [organizationId, context.source_package_id]);
      if (!client) throw failure('client_not_found', 404);
      if (!service || service.billing_unit !== 'hour') throw failure('service_not_found', 404);
      if (!source) throw failure('package_upgrade_source_not_found', 404);
      if (source.status !== 'active') throw failure('package_upgrade_source_inactive');
      if (Number(source.client_id) !== Number(payload.client_id)) throw failure('package_upgrade_client_mismatch');
      if (Number(source.version) !== Number(context.expected_source_version)) throw failure('stale_package_upgrade_source', 409);
      if (context.close_source_package && Number(source.held_minutes) > 0) throw failure('package_upgrade_source_committed');
      if (context.close_source_package) {
        const active = await get(this.db, `SELECT s.id FROM booking_sessions s
          JOIN bookings b ON b.id = s.booking_id AND b.organization_id = s.organization_id
          WHERE s.organization_id = ? AND b.client_package_id = ? AND s.status = 'active' LIMIT 1`, [organizationId, source.id]);
        if (active) throw failure('package_upgrade_source_committed');
      }

      const inserted = await run(this.db, `INSERT INTO client_packages
        (organization_id, client_id, service_id, name, billing_unit, purchased_minutes, payment_due_minutes, overage_rate_cents, total_cents, paid_cents, starts_at, expires_at, status, version)
        VALUES (?, ?, ?, ?, 'hour', ?, ?, ?, ?, ?, '2026-08-22', '2026-11-20', 'active', 1)`,
      [organizationId, payload.client_id, payload.service_id, payload.name, purchasedMinutes, paymentDueMinutes, overage.cents, total.cents, paid.cents]);
      const packageId = inserted.lastID;
      fault('package');
      await run(this.db, `INSERT INTO package_usage_ledger
        (organization_id, client_package_id, movement_type, quantity_minutes, event_key)
        VALUES (?, ?, 'opening', ?, ?)`, [organizationId, packageId, purchasedMinutes, `upgrade:${payload.idempotency_key}:opening`]);
      fault('ledger');

      let paymentId = null;
      if (paid.cents > 0) {
        const payment = await run(this.db, `INSERT INTO payments
          (organization_id, client_id, amount_cents, reference) VALUES (?, ?, ?, ?)`,
        [organizationId, payload.client_id, paid.cents, `package-${packageId}-opening`]);
        paymentId = payment.lastID;
        fault('payment');
        await run(this.db, `INSERT INTO payment_allocations
          (organization_id, payment_id, client_package_id, amount_cents) VALUES (?, ?, ?, ?)`,
        [organizationId, paymentId, packageId, paid.cents]);
        fault('allocation');
        await run(this.db, `INSERT INTO finance
          (organization_id, client_id, amount_cents, correlation_id) VALUES (?, ?, ?, ?)`,
        [organizationId, payload.client_id, paid.cents, `payment:${paymentId}`]);
        fault('finance');
      }

      await run(this.db, `INSERT INTO audit_logs(organization_id, action, entity_id)
        VALUES (?, 'owner_upgrade_package_create', ?)`, [organizationId, packageId]);
      fault('upgrade_audit');
      if (context.close_source_package) {
        const update = await run(this.db, `UPDATE client_packages SET status = 'completed', version = version + 1
          WHERE organization_id = ? AND id = ? AND version = ?`, [organizationId, source.id, context.expected_source_version]);
        if (update.changes !== 1) throw failure('stale_package_upgrade_source', 409);
        fault('source_update');
        await run(this.db, `INSERT INTO owner_adjustments
          (organization_id, entity_id, adjustment_type, reason) VALUES (?, ?, 'package_upgrade_close', ?)`,
        [organizationId, source.id, context.reason]);
        fault('adjustment');
        await run(this.db, `INSERT INTO audit_logs(organization_id, action, entity_id)
          VALUES (?, 'owner_upgrade_package_close_source', ?)`, [organizationId, source.id]);
        fault('source_audit');
        await run(this.db, `INSERT INTO change_events(organization_id, entity_id, change_type)
          VALUES (?, ?, 'package_upgrade_source_closed')`, [organizationId, source.id]);
        fault('source_change');
      }
      await run(this.db, `INSERT INTO change_events(organization_id, entity_id, change_type)
        VALUES (?, ?, 'package_upgraded')`, [organizationId, packageId]);
      fault('replacement_change');
      await run(this.db, `INSERT INTO notifications(organization_id, client_id, entity_id, source_key)
        VALUES (?, ?, ?, ?)`, [organizationId, payload.client_id, packageId, `package-upgraded:${packageId}`]);
      fault('notification');

      const response = { id: packageId, payment_id: paymentId, purchased_minutes: purchasedMinutes, total_cents: total.cents, paid_cents: paid.cents, overage_rate_cents: overage.cents, source_package_id: source.id, source_closed: Boolean(context.close_source_package) };
      await run(this.db, `UPDATE package_sale_requests SET status = 'completed', response_json = ?
        WHERE id = ? AND organization_id = ?`, [JSON.stringify(response), request.lastID, organizationId]);
      fault('request_complete');
      await exec(this.db, 'COMMIT');
      return { ...response, idempotent: false };
    } catch (error) {
      await exec(this.db, 'ROLLBACK');
      throw error;
    }
  }
}
