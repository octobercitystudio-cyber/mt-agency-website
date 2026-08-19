import { mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sqlite3 from 'sqlite3';

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

const fail = code => Object.assign(new Error(code), { code });
const canonicalLinks = links => links
  .map(link => ({
    title: String(link.title ?? '').trim(),
    link_kind: link.link_kind === 'video' ? 'video' : 'folder',
    url: String(link.url ?? '').trim(),
    is_active: Number(link.is_active ?? 1) ? 1 : 0,
  }))
  .sort((a, b) => `${a.url}\u0000${a.title}`.localeCompare(`${b.url}\u0000${b.title}`));

const transitions = {
  editing_in_progress: ['editing_completed'],
  editing_completed: ['uploading', 'ready_for_pickup'],
  uploading: ['upload_completed'],
  upload_completed: ['delivered'],
  ready_for_pickup: ['delivered'],
  delivered: [],
};

export class ProductionLikePostProductionHarness {
  constructor(db, pickupDirectory) {
    this.db = db;
    this.pickupDirectory = pickupDirectory;
  }

  static async create() {
    const db = new sqlite3.Database(':memory:');
    const pickupDirectory = await mkdtemp(join(tmpdir(), 'mta-job-pickup-'));
    const harness = new ProductionLikePostProductionHarness(db, pickupDirectory);
    await exec(db, `
      PRAGMA foreign_keys = ON;
      CREATE TABLE organizations (id INTEGER PRIMARY KEY);
      CREATE TABLE clients (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id)
      );
      CREATE TABLE jobs (
        id INTEGER PRIMARY KEY,
        organization_id INTEGER NOT NULL REFERENCES organizations(id),
        client_id INTEGER NOT NULL REFERENCES clients(id),
        status TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        visible INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL REFERENCES jobs(id),
        from_status TEXT NOT NULL,
        to_status TEXT NOT NULL,
        version INTEGER NOT NULL,
        UNIQUE(job_id, version)
      );
      CREATE TABLE links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL REFERENCES jobs(id),
        title TEXT NOT NULL,
        link_kind TEXT NOT NULL,
        url TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE TABLE notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        job_id INTEGER NOT NULL,
        source_key TEXT NOT NULL UNIQUE,
        tab TEXT NOT NULL
      );
    `);
    await run(db, 'INSERT INTO organizations(id) VALUES (1), (2)');
    await run(db, 'INSERT INTO clients(id, organization_id) VALUES (11, 1), (22, 2)');
    await run(db, `INSERT INTO jobs(id, organization_id, client_id, status, version, visible)
      VALUES (101, 1, 11, 'editing_in_progress', 1, 1), (202, 2, 22, 'editing_in_progress', 1, 1),
             (103, 1, 11, 'upload_completed', 4, 1), (104, 1, 11, 'editing_in_progress', 1, 1)`);
    await run(db, `INSERT INTO links(organization_id, job_id, title, link_kind, url, is_active, created_at)
      VALUES (1, 103, 'النسخة القديمة', 'folder', 'https://drive.google.com/drive/folders/old', 1, '2026-08-18T10:00:00.000Z')`);
    return harness;
  }

  async close() {
    await new Promise((resolve, reject) => this.db.close(error => (error ? reject(error) : resolve())));
    await rm(this.pickupDirectory, { recursive: true, force: true });
  }

  async transaction(work) {
    await exec(this.db, 'BEGIN IMMEDIATE');
    try {
      const result = await work();
      await exec(this.db, 'COMMIT');
      return result;
    } catch (error) {
      await exec(this.db, 'ROLLBACK');
      throw error;
    }
  }

  async listForClient(organizationId, clientId) {
    return all(this.db, `SELECT id, status, version FROM jobs
      WHERE organization_id = ? AND client_id = ? AND visible = 1 ORDER BY id`, [organizationId, clientId]);
  }

  async job(organizationId, jobId) {
    return get(this.db, 'SELECT * FROM jobs WHERE organization_id = ? AND id = ?', [organizationId, jobId]);
  }

  async rows(table, jobId) {
    if (!['history', 'links', 'notifications'].includes(table)) throw fail('unsafe_table');
    return all(this.db, `SELECT * FROM ${table} WHERE job_id = ? ORDER BY id`, [jobId]);
  }

  async pickupStore(organizationId, jobId) {
    const job = await this.job(organizationId, jobId);
    if (!job) throw fail('post_production_not_found');
    return new RevisionSafePickupStore(join(this.pickupDirectory, `org-${organizationId}-job-${jobId}.json`));
  }

  async readPickup({ organizationId, jobId, clientId = null }) {
    const job = await this.job(organizationId, jobId);
    if (!job || clientId != null && (Number(job.client_id) !== Number(clientId) || Number(job.visible) !== 1)) throw fail('post_production_not_found');
    return (await this.pickupStore(organizationId, jobId)).read();
  }

  async savePickup({ organizationId, jobId, expectedRevision, value }) {
    return (await this.pickupStore(organizationId, jobId)).write(expectedRevision, value);
  }

  async clientLinks({ organizationId, clientId, jobId, now }) {
    const job = await this.job(organizationId, jobId);
    if (!job || Number(job.client_id) !== Number(clientId) || Number(job.visible) !== 1) throw fail('post_production_not_found');
    const links = await all(this.db, 'SELECT * FROM links WHERE organization_id = ? AND job_id = ? AND is_active = 1 ORDER BY id', [organizationId, jobId]);
    return links.filter(link => Date.parse(link.created_at) + 48 * 60 * 60 * 1000 > now).map(link => ({ ...link, available_until: new Date(Date.parse(link.created_at) + 48 * 60 * 60 * 1000).toISOString() }));
  }

  async transition({ organizationId, jobId, desired, expectedVersion, injectFailureAt = '' }) {
    return this.transaction(async () => {
      const before = await this.job(organizationId, jobId);
      if (!before) throw fail('post_production_not_found');
      const currentVersion = Number(before.version);
      const exactReplay = before.status === desired
        && (Number(expectedVersion) === currentVersion || Number(expectedVersion) === currentVersion - 1);
      if (exactReplay) return { ...before, idempotent: true };
      if (Number(expectedVersion) !== currentVersion) throw fail('post_production_version_conflict');
      if (!(transitions[before.status] ?? []).includes(desired)) throw fail('invalid_post_production_transition');

      const nextVersion = currentVersion + 1;
      await run(this.db, 'UPDATE jobs SET status = ?, version = ? WHERE organization_id = ? AND id = ?', [desired, nextVersion, organizationId, jobId]);
      await run(this.db, `INSERT INTO history(organization_id, job_id, from_status, to_status, version)
        VALUES (?, ?, ?, ?, ?)`, [organizationId, jobId, before.status, desired, nextVersion]);
      if (injectFailureAt === 'after_history') throw fail('injected_failure');
      await run(this.db, `INSERT OR IGNORE INTO notifications(organization_id, client_id, job_id, source_key, tab)
        VALUES (?, ?, ?, ?, ?)`, [organizationId, before.client_id, jobId, `post-production:${jobId}:version:${nextVersion}`, 'videos']);
      if (injectFailureAt === 'after_notification') throw fail('injected_failure');
      return this.job(organizationId, jobId);
    });
  }

  async saveLinks({ organizationId, jobId, links, expectedVersion, injectFailureAt = '' }) {
    return this.transaction(async () => {
      const before = await this.job(organizationId, jobId);
      if (!before) throw fail('post_production_not_found');
      const currentLinks = canonicalLinks(await all(this.db, `SELECT title, link_kind, url, is_active
        FROM links WHERE organization_id = ? AND job_id = ?`, [organizationId, jobId]));
      const desiredLinks = canonicalLinks(links);
      const currentVersion = Number(before.version);
      const exactReplay = JSON.stringify(currentLinks) === JSON.stringify(desiredLinks)
        && (Number(expectedVersion) === currentVersion || Number(expectedVersion) === currentVersion - 1);
      if (exactReplay) return { ...before, links: currentLinks, idempotent: true };
      if (Number(expectedVersion) !== currentVersion) throw fail('post_production_version_conflict');

      await run(this.db, 'DELETE FROM links WHERE organization_id = ? AND job_id = ?', [organizationId, jobId]);
      if (injectFailureAt === 'after_delete') throw fail('injected_failure');
      for (const link of desiredLinks) {
        await run(this.db, `INSERT INTO links(organization_id, job_id, title, link_kind, url, is_active, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`, [organizationId, jobId, link.title, link.link_kind, link.url, link.is_active, new Date().toISOString()]);
      }
      const nextVersion = currentVersion + 1;
      await run(this.db, 'UPDATE jobs SET version = ? WHERE organization_id = ? AND id = ?', [nextVersion, organizationId, jobId]);
      return { ...(await this.job(organizationId, jobId)), links: desiredLinks };
    });
  }
}

class AsyncMutex {
  constructor() {
    this.tail = Promise.resolve();
  }

  async run(work) {
    const previous = this.tail;
    let release;
    this.tail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  }
}

export class RevisionSafePickupStore {
  constructor(file) {
    this.file = file;
    this.lock = new AsyncMutex();
  }

  async read() {
    try { return JSON.parse(await readFile(this.file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw error;
    }
  }

  async write(expectedRevision, value) {
    return this.lock.run(async () => {
      const current = await this.read();
      const currentRevision = Number(current?.revision ?? 0);
      const comparableCurrent = current ? { expires_at: current.expires_at, windows: current.windows } : null;
      const comparableNext = { expires_at: value.expires_at, windows: value.windows };
      if (current && JSON.stringify(comparableCurrent) === JSON.stringify(comparableNext) && [currentRevision, currentRevision - 1].includes(Number(expectedRevision))) return { ...current, idempotent: true };
      if (currentRevision !== Number(expectedRevision)) throw fail('pickup_revision_conflict');
      const next = { ...value, revision: Number(expectedRevision) + 1 };
      const temporary = `${this.file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(next), 'utf8');
      await rename(temporary, this.file);
      return { ...next, idempotent: false };
    });
  }

  async readAndCleanupExpired({ now = Date.now(), afterExpiredObserved } = {}) {
    const observed = await this.read();
    if (!observed || Date.parse(observed.expires_at) > now) return observed;
    await afterExpiredObserved?.(observed);
    return this.lock.run(async () => {
      const latest = await this.read();
      if (!latest || Date.parse(latest.expires_at) > now) return latest;
      if (Number(latest.revision) !== Number(observed.revision) || latest.expires_at !== observed.expires_at) return latest;
      await unlink(this.file);
      return null;
    });
  }
}
