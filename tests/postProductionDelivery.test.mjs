import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ProductionLikePostProductionHarness, RevisionSafePickupStore } from './helpers/postProductionProductionHarness.mjs';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const setupBrowser = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {}, setTimeout, clearTimeout };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return storage;
};

test('migration adds an isolated append-only post-production layer and private legacy backfill', async () => {
  const migration = await load('database/mysql/031_post_production_and_video_deliveries.sql');
  for (const table of ['post_production_jobs', 'post_production_status_history', 'video_delivery_links']) assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(migration, /UNIQUE KEY uq_post_production_session \(booking_session_id\)/);
  assert.match(migration, /UNIQUE KEY uq_post_production_booking \(booking_id\)/);
  assert.match(migration, /UNIQUE KEY uq_post_production_history_version \(post_production_job_id, version\)/);
  assert.match(migration, /UNIQUE KEY uq_video_delivery_job_url \(post_production_job_id, url_hash\)/);
  for (const foreignKey of ['booking_sessions', 'bookings', 'clients', 'users', 'post_production_jobs']) assert.match(migration, new RegExp(`REFERENCES ${foreignKey}\\(`));
  assert.match(migration, /WHERE bs\.status = 'completed'/);
  assert.match(migration, /needs_review, is_client_visible/);
  assert.match(migration, /1, 0, bs\.ended_by/);
});

test('production settlement creates one job safely and the API enforces versioned transitions, isolation, atomic Drive links and private pickup TTL', async () => {
  const [api, settlement, module, config] = await Promise.all([
    load('api/index.php'), load('api/session_settlement.php'), load('api/post_production.php'), load('api/config.example.php'),
  ]);
  assert.match(api, /require_once __DIR__ \. '\/post_production\.php'/);
  assert.match(api, /handlePostProductionRoutes\(\$pdo, \$config, \$user, \$path, \$method\)/);
  assert.ok(api.indexOf("'/post_production.php'") < api.indexOf("'/session_settlement.php'"));
  assert.match(settlement, /createPostProductionJobForCompletedSession\(\$pdo,\$user,\$booking,\$completedSession\)/);
  assert.match(settlement, /'post_production_job_id'=>\$postProductionJobId/);
  assert.match(module, /if \(!postProductionSchemaReady\(\$pdo\)\) return null/);
  assert.match(module, /INSERT IGNORE INTO post_production_jobs/);
  assert.match(module, /FOR UPDATE/);
  assert.match(module, /post_production_version_conflict/);
  assert.match(module, /invalid_post_production_transition/);
  assert.match(module, /\$next===\$before\['status'\]/);
  assert.match(module, /beginTransaction\(\).*post_production_status_history/s);
  assert.match(module, /post-production:'\.\$id\.'\:version:'\.\$version/);
  assert.match(module, /requireRole\(\$user,\['owner','admin','operations'\]\)/);
  assert.match(module, /j\.organization_id=\?/);
  assert.match(module, /j\.client_id=\?/);
  assert.doesNotMatch(module.slice(module.indexOf("if ($clientOnly)"), module.indexOf("function validateDriveDeliveryLinks")), /\$row\['history'\] = \$clientOnly/);
  assert.match(module, /\['drive\.google\.com','docs\.google\.com'\]/);
  assert.match(module, /DELETE FROM video_delivery_links.*INSERT INTO video_delivery_links/s);
  assert.match(module, /l\.created_at > DATE_SUB\(NOW\(\), INTERVAL 48 HOUR\)/);
  assert.match(module, /DATE_ADD\(l\.created_at,INTERVAL 48 HOUR\) AS available_until/);
  assert.match(module, /private_runtime_dir/);
  assert.match(module, /pickup_runtime_not_private/);
  assert.match(module, /\+7 days/);
  assert.match(module, /expected_revision/);
  assert.match(module, /LOCK_EX/);
  assert.match(module, /org-' \. \$organizationId \. '-job-' \. \$jobId \. '\.json'/);
  assert.match(module, /pickupLock\(\$file\).*readPickupAvailability\(\$config, \$organizationId, \$jobId, false\).*\$latest\['revision'\].*\$observedRevision/s);
  assert.match(module, /chmod\(\$file,0600\)/);
  assert.match(api, /payload_json FROM app_notifications/);
  assert.match(api, /post_production_job_id.*FILTER_VALIDATE_INT.*['"]&['"].*job=/s);
  assert.match(config, /private_runtime_dir/);
});

test('demo matches owner and client post-production contracts end to end', async () => {
  const storage = setupBrowser();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  await resetDemoDatabase(); activateDemoMode('owner', 1);

  const ownerList = await demoClient.request('/post-production?status=all', { method: 'GET' });
  assert.equal(ownerList.error, null); assert.ok(ownerList.data.items.length >= 2);
  const editable = ownerList.data.items.find(item => Number(item.id) === 1902);
  assert.deepEqual(editable.valid_next_statuses, ['editing_completed']); assert.ok(Array.isArray(editable.history));

  const invalid = await demoClient.request('/post-production/1902/status', { method: 'PATCH', body: JSON.stringify({ status: 'uploading', expected_version: 1 }) });
  assert.equal(invalid.error.code, 'invalid_post_production_transition');
  const stale = await demoClient.request('/post-production/1902/status', { method: 'PATCH', body: JSON.stringify({ status: 'editing_completed', expected_version: 9 }) });
  assert.equal(stale.error.code, 'post_production_version_conflict');
  const changed = await demoClient.request('/post-production/1902/status', { method: 'PATCH', body: JSON.stringify({ status: 'editing_completed', expected_version: 1 }) });
  assert.equal(changed.error, null); assert.equal(changed.data.version, 2);
  const replay = await demoClient.request('/post-production/1902/status', { method: 'PATCH', body: JSON.stringify({ status: 'editing_completed', expected_version: 1 }) });
  assert.equal(replay.error, null); assert.equal(replay.data.idempotent, true);
  const staleDifferent = await demoClient.request('/post-production/1902/status', { method: 'PATCH', body: JSON.stringify({ status: 'uploading', expected_version: 1 }) });
  assert.equal(staleDifferent.error.code, 'post_production_version_conflict');
  const afterTransition = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.equal(afterTransition.post_production_status_history.filter(row => Number(row.post_production_job_id) === 1902 && row.to_status === 'editing_completed').length, 1);
  assert.equal(afterTransition.app_notifications.filter(row => row.source_event_key === 'post-production:1902:version:2').length, 1);

  const originalLinks = afterTransition.video_delivery_links.filter(row => Number(row.post_production_job_id) === 1901);
  const badLinks = await demoClient.request('/post-production/1901/delivery-links', { method: 'PUT', body: JSON.stringify({ expected_version: 4, links: [{ title: 'صحيح', link_kind: 'folder', url: 'https://drive.google.com/drive/folders/new' }, { title: 'خطر', link_kind: 'video', url: 'https://example.com/file' }] }) });
  assert.equal(badLinks.error.code, 'untrusted_delivery_link');
  assert.deepEqual(JSON.parse(storage.get('mt_agency_erp_demo_v12')).video_delivery_links.filter(row => Number(row.post_production_job_id) === 1901), originalLinks);
  const goodLinksPayload = [{ title: 'نسخة العميل', link_kind: 'folder', url: 'https://drive.google.com/drive/folders/client-ready', is_active: 1 }];
  const goodLinks = await demoClient.request('/post-production/1901/delivery-links', { method: 'PUT', body: JSON.stringify({ expected_version: 4, links: goodLinksPayload }) });
  assert.equal(goodLinks.error, null); assert.equal(goodLinks.data.version, 5);
  const linksReplay = await demoClient.request('/post-production/1901/delivery-links', { method: 'PUT', body: JSON.stringify({ expected_version: 4, links: goodLinksPayload }) });
  assert.equal(linksReplay.error, null); assert.equal(linksReplay.data.idempotent, true);
  const staleDifferentLinks = await demoClient.request('/post-production/1901/delivery-links', { method: 'PUT', body: JSON.stringify({ expected_version: 4, links: [{ ...goodLinksPayload[0], title: 'نسخة مختلفة' }] }) });
  assert.equal(staleDifferentLinks.error.code, 'post_production_version_conflict');

  const pickupBefore = await demoClient.request('/post-production/1901/pickup-availability', { method: 'GET' });
  const date = new Date(); date.setDate(date.getDate() + 2); const dateKey = date.toISOString().slice(0, 10);
  const expiry = new Date(); expiry.setDate(expiry.getDate() + 3);
  const pickupChanged = await demoClient.request('/post-production/1901/pickup-availability', { method: 'PUT', body: JSON.stringify({ expected_revision: pickupBefore.data.revision, expires_at: expiry.toISOString(), windows: [{ date: dateKey, start_time: '14:00', end_time: '18:00', label: 'متاحون في الشركة' }] }) });
  assert.equal(pickupChanged.error, null); assert.equal(pickupChanged.data.revision, pickupBefore.data.revision + 1);
  const pickupReplay = await demoClient.request('/post-production/1901/pickup-availability', { method: 'PUT', body: JSON.stringify({ expected_revision: pickupBefore.data.revision, expires_at: expiry.toISOString(), windows: [{ date: dateKey, start_time: '14:00', end_time: '18:00', label: 'متاحون في الشركة' }] }) });
  assert.equal(pickupReplay.error, null); assert.equal(pickupReplay.data.idempotent, true);
  const pickupConflict = await demoClient.request('/post-production/1901/pickup-availability', { method: 'PUT', body: JSON.stringify({ expected_revision: pickupBefore.data.revision, expires_at: expiry.toISOString(), windows: [] }) });
  assert.equal(pickupConflict.error.code, 'pickup_revision_conflict');

  activateDemoMode('client', 1);
  const forbidden = await demoClient.request('/post-production', { method: 'GET' }); assert.equal(forbidden.error.code, 'forbidden');
  const clientList = await demoClient.request('/client/post-production', { method: 'GET' });
  assert.equal(clientList.error, null); assert.ok(clientList.data.items.every(item => Number(item.id) !== 1902));
  assert.ok(clientList.data.items.every(item => ['history', 'valid_next_statuses', 'client_id', 'booking_session_id', 'created_by', 'updated_by', 'needs_review', 'is_client_visible', 'version'].every(field => !Object.hasOwn(item, field))));
  const ready = clientList.data.items.find(item => Number(item.id) === 1901); assert.equal(ready.delivery_links.length, 1); assert.match(ready.delivery_links[0].url, /^https:\/\/drive\.google\.com\//);
  assert.ok(ready.delivery_links[0].available_until); assert.equal(ready.delivery_link_count, ready.delivery_links.length); assert.equal(ready.pickup_availability.windows.length, 1);
  const otherClientPickup = await demoClient.request('/post-production/1902/pickup-availability', { method: 'GET' }); assert.equal(otherClientPickup.error.code, 'post_production_not_found');
  deactivateDemoMode();
});

test('owner and client interfaces expose responsive tabs, safe deep links, status flow and temporary pickup guidance', async () => {
  const [app, layout, owner, ownerCss, dashboard, client, clientCss, login, notifications] = await Promise.all([
    load('src/App.jsx'), load('src/erp/ERPLayout.jsx'), load('src/erp/ERPPostProduction.jsx'), load('src/erp/ERPPostProduction.css'), load('src/pages/ClientDashboard.jsx'), load('src/pages/ClientPostProduction.jsx'), load('src/pages/ClientPostProduction.css'), load('src/pages/UnifiedLogin.jsx'), load('api/post_production.php'),
  ]);
  assert.match(app, /path="post-production"/); assert.match(app, /ERPPostProduction/);
  assert.match(layout, /\/erp\/post-production/); assert.match(layout, /المونتاج والتسليم/);
  for (const copy of ['العمل النشط', 'التفاصيل والتحكم', 'روابط Google Drive', 'تاريخ الحالات', 'فترة استلام هذه المهمة']) assert.ok(owner.includes(copy), copy);
  assert.match(owner, /expected_version/); assert.match(owner, /expected_revision/); assert.match(owner, /valid_next_statuses/);
  assert.match(owner, /OwnerProgressRail/); assert.match(ownerCss, /owner-production-rail/);
  assert.match(ownerCss, /@media\(max-width:1100px\)/); assert.match(ownerCss, /@media\(max-width:768px\)/); assert.match(ownerCss, /@media\(max-width:430px\)/);
  assert.match(dashboard, /CLIENT_TABS = \['home', 'schedule', 'finance', 'offers', 'videos', 'security'\]/);
  assert.doesNotMatch(dashboard, /navigateClient\('montage'\)|activeTab === 'montage'|mode="montage"/);
  assert.match(dashboard, /client-nav-more/); assert.match(dashboard, /post_production_job_id/); assert.match(dashboard, /searchParams\.get\('tab'\)/);
  assert.match(login, /returnTo/); assert.match(login, /CLIENT_TABS\.includes\(tab\)/);
  for (const copy of ['تسليمات الفيديوهات', 'المدة المصورة', 'فترة الاستلام من مقر الشركة', 'روابط الفيديوهات', 'برجاء التحميل في خلال 48 ساعة من الرفع ويتم حذف الروابط بشكل تلقائي ويمكنكم استلامها من مقر الشركة فيما بعد في مدة اقصاها اسبوع من تاريخ التصوير']) assert.ok(client.includes(copy), copy);
  assert.match(client, /target="_blank" rel="noopener noreferrer"/); assert.match(client, /useChangeSync/); assert.match(client, /30000/); assert.match(client, /pickup_availability/); assert.match(client, /available_until/);
  assert.match(clientCss, /@media\(max-width:680px\)/); assert.match(clientCss, /@media\(max-width:350px\)/);
  assert.match(notifications, /'upload_completed'.*'videos'/s); assert.match(notifications, /'editing_completed'.*'videos'/s); assert.doesNotMatch(notifications, /'editing_completed'.*'montage'/s);
  assert.match(owner, /post-production\/\$\{selected\.id\}\/pickup-availability/); assert.doesNotMatch(owner, /request\('\/pickup-availability'/); assert.match(owner, /resetPickupEditor/);
});

test('production-like database transactions roll back status, history and notifications together', async t => {
  const harness = await ProductionLikePostProductionHarness.create();
  t.after(() => harness.close());

  await assert.rejects(
    harness.transition({ organizationId: 1, jobId: 104, desired: 'editing_completed', expectedVersion: 1, injectFailureAt: 'after_notification' }),
    error => error.code === 'injected_failure',
  );
  const job = await harness.job(1, 104);
  assert.equal(job.status, 'editing_in_progress');
  assert.equal(job.version, 1);
  assert.deepEqual(await harness.rows('history', 104), []);
  assert.deepEqual(await harness.rows('notifications', 104), []);
});

test('production-like database scopes every owner and client read/write to the organization', async t => {
  const harness = await ProductionLikePostProductionHarness.create();
  t.after(() => harness.close());

  assert.deepEqual((await harness.listForClient(1, 11)).map(row => row.id), [101, 103, 104]);
  assert.deepEqual((await harness.listForClient(1, 22)).map(row => row.id), []);
  assert.deepEqual((await harness.listForClient(2, 22)).map(row => row.id), [202]);
  await assert.rejects(
    harness.transition({ organizationId: 1, jobId: 202, desired: 'editing_completed', expectedVersion: 1 }),
    error => error.code === 'post_production_not_found',
  );
  assert.equal((await harness.job(2, 202)).status, 'editing_in_progress');
});

test('production-like status retry is exact-once while a stale different command conflicts', async t => {
  const harness = await ProductionLikePostProductionHarness.create();
  t.after(() => harness.close());

  const changed = await harness.transition({ organizationId: 1, jobId: 101, desired: 'editing_completed', expectedVersion: 1 });
  assert.equal(changed.version, 2);
  const lostResponseRetry = await harness.transition({ organizationId: 1, jobId: 101, desired: 'editing_completed', expectedVersion: 1 });
  assert.equal(lostResponseRetry.idempotent, true);
  assert.equal((await harness.rows('history', 101)).length, 1);
  assert.equal((await harness.rows('notifications', 101)).length, 1);
  await assert.rejects(
    harness.transition({ organizationId: 1, jobId: 101, desired: 'uploading', expectedVersion: 1 }),
    error => error.code === 'post_production_version_conflict',
  );
});

test('production-like Drive link retry is idempotent, stale-different conflicts and replacement rollback is atomic', async t => {
  const harness = await ProductionLikePostProductionHarness.create();
  t.after(() => harness.close());
  const links = [{ title: 'نسخة العميل', link_kind: 'folder', url: 'https://drive.google.com/drive/folders/client-ready', is_active: 1 }];

  const changed = await harness.saveLinks({ organizationId: 1, jobId: 103, links, expectedVersion: 4 });
  assert.equal(changed.version, 5);
  const lostResponseRetry = await harness.saveLinks({ organizationId: 1, jobId: 103, links, expectedVersion: 4 });
  assert.equal(lostResponseRetry.idempotent, true);
  await assert.rejects(
    harness.saveLinks({ organizationId: 1, jobId: 103, links: [{ ...links[0], title: 'مختلفة' }], expectedVersion: 4 }),
    error => error.code === 'post_production_version_conflict',
  );
  await assert.rejects(
    harness.saveLinks({ organizationId: 1, jobId: 103, links: [{ ...links[0], title: 'لن تحفظ' }], expectedVersion: 5, injectFailureAt: 'after_delete' }),
    error => error.code === 'injected_failure',
  );
  const persisted = await harness.rows('links', 103);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].title, 'نسخة العميل');
  assert.equal((await harness.job(1, 103)).version, 5);
});

test('expired pickup cleanup re-reads under the writer lock and cannot unlink a concurrently refreshed file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mta-pickup-race-'));
  const file = join(directory, 'pickup-availability.json');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new RevisionSafePickupStore(file);
  await writeFile(file, JSON.stringify({ revision: 1, expires_at: '2025-01-01T00:00:00.000Z', windows: [] }), 'utf8');

  let writerRan = false;
  const observed = await store.readAndCleanupExpired({
    now: Date.parse('2026-08-18T12:00:00.000Z'),
    afterExpiredObserved: async () => {
      const refreshed = await store.write(1, { expires_at: '2026-08-20T18:00:00.000Z', windows: [{ date: '2026-08-20', start_time: '14:00', end_time: '18:00' }] });
      writerRan = true;
      assert.equal(refreshed.revision, 2);
    },
  });
  assert.equal(writerRan, true);
  assert.equal(observed.revision, 2);
  assert.equal((await store.read()).revision, 2);
});

test('job-scoped pickup files keep revisions, organizations and clients isolated', async t => {
  const harness = await ProductionLikePostProductionHarness.create();
  t.after(() => harness.close());
  const expiresAt = new Date(Date.now() + 3 * 86400000).toISOString();
  const valueA = { expires_at: expiresAt, windows: [{ date: expiresAt.slice(0, 10), start_time: '14:00', end_time: '16:00', label: 'المهمة A' }] };
  const valueB = { expires_at: expiresAt, windows: [{ date: expiresAt.slice(0, 10), start_time: '17:00', end_time: '19:00', label: 'المهمة B' }] };

  const firstA = await harness.savePickup({ organizationId: 1, jobId: 101, expectedRevision: 0, value: valueA });
  assert.equal(firstA.revision, 1);
  assert.equal(await harness.readPickup({ organizationId: 1, jobId: 104, clientId: 11 }), null);
  const firstB = await harness.savePickup({ organizationId: 1, jobId: 104, expectedRevision: 0, value: valueB });
  assert.equal(firstB.revision, 1);
  assert.equal((await harness.readPickup({ organizationId: 1, jobId: 101, clientId: 11 })).windows[0].label, 'المهمة A');
  assert.equal((await harness.readPickup({ organizationId: 1, jobId: 104, clientId: 11 })).windows[0].label, 'المهمة B');
  const replay = await harness.savePickup({ organizationId: 1, jobId: 101, expectedRevision: 0, value: valueA });
  assert.equal(replay.idempotent, true); assert.equal(replay.revision, 1);
  await assert.rejects(harness.savePickup({ organizationId: 1, jobId: 101, expectedRevision: 0, value: valueB }), error => error.code === 'pickup_revision_conflict');
  await assert.rejects(harness.readPickup({ organizationId: 1, jobId: 101, clientId: 22 }), error => error.code === 'post_production_not_found');
  await assert.rejects(harness.savePickup({ organizationId: 1, jobId: 202, expectedRevision: 0, value: valueA }), error => error.code === 'post_production_not_found');
});

test('client Drive links are visible at 47:59 and soft-expire exactly at 48:00 without deleting owner history', async t => {
  const harness = await ProductionLikePostProductionHarness.create();
  t.after(() => harness.close());
  const createdAt = Date.parse('2026-08-18T10:00:00.000Z');
  const visible = await harness.clientLinks({ organizationId: 1, clientId: 11, jobId: 103, now: createdAt + (48 * 60 * 60 * 1000) - 1000 });
  assert.equal(visible.length, 1); assert.equal(visible[0].available_until, '2026-08-20T10:00:00.000Z');
  const expired = await harness.clientLinks({ organizationId: 1, clientId: 11, jobId: 103, now: createdAt + 48 * 60 * 60 * 1000 });
  assert.equal(expired.length, 0);
  assert.equal((await harness.rows('links', 103)).length, 1);
});

test('legacy client destinations normalize to videos while preserving the focused job', async () => {
  const [dashboard, login, notifications, worker, api] = await Promise.all([
    load('src/pages/ClientDashboard.jsx'), load('src/pages/UnifiedLogin.jsx'), load('src/pages/ClientNotifications.jsx'), load('public/sw.js'), load('api/index.php'),
  ]);
  assert.match(dashboard, /requestedTab === 'montage' \? 'videos'/); assert.match(dashboard, /normalized\.set\('tab', 'videos'\)/); assert.match(dashboard, /searchParams\.get\('job'\)/);
  assert.match(login, /rawTab === 'montage' \? 'videos'/); assert.match(login, /url\.searchParams\.set\('tab', 'videos'\)/);
  assert.match(notifications, /destination === 'montage' \? 'videos'/); assert.match(worker, /searchParams\.get\('tab'\) === 'montage'/);
  assert.match(api, /if\(\$tab==='montage'\)\$tab='videos'/); assert.match(api, /if\(\$actionTab==='montage'\)\$actionTab='videos'/);
});

test('demo upgrader preserves general pickup as legacy without copying it to every job', async () => {
  const storage = setupBrowser();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  await resetDemoDatabase();
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  const legacy = { revision: 7, expires_at: new Date(Date.now() + 86400000).toISOString(), windows: [{ date: new Date(Date.now() + 86400000).toISOString().slice(0, 10), start_time: '14:00', end_time: '17:00', label: 'عام قديم' }] };
  database.pickup_availability = legacy; delete database.pickup_availability_legacy; delete database.pickup_availability_by_job;
  storage.set('mt_agency_erp_demo_v12', JSON.stringify(database)); activateDemoMode('owner', 1);
  await demoClient.request('/post-production?status=all', { method: 'GET' });
  const upgraded = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.deepEqual(upgraded.pickup_availability_legacy, legacy); assert.deepEqual(upgraded.pickup_availability_by_job, {});
  deactivateDemoMode();
});
