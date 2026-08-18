import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const setupBrowser = () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {}, setTimeout, clearTimeout };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return storage;
};

test('client dashboard owns the requested four simple pages and appointment actions', async () => {
  const [dashboard, overview, finance, offers, css] = await Promise.all([
    load('src/pages/ClientDashboard.jsx'), load('src/pages/ClientDashboardOverview.jsx'), load('src/pages/ClientFinanceView.jsx'), load('src/pages/ClientOfferTickets.jsx'), load('src/pages/ClientDashboard.css'),
  ]);
  const nav = dashboard.slice(dashboard.indexOf('<nav aria-label="التنقل الرئيسي"'), dashboard.indexOf('</nav>'));
  for (const label of ['الرئيسية', 'المواعيد', 'المالية', 'العروض']) assert.match(nav, new RegExp(label));
  assert.doesNotMatch(nav, /الباقات والخدمات|سجل الخدمات/);
  for (const label of ['موعد التصوير القادم', 'مدة الحجز', 'إجمالي الباقة', 'المستخدم', 'إجمالي التكلفة', 'المتبقي']) assert.ok(overview.includes(label), label);
  assert.doesNotMatch(overview, /notifications|client-home-notification-card/); assert.match(overview, /نقاط حسابك/);
  assert.equal((dashboard.match(/<ClientNotifications/g) || []).length, 1);
  assert.match(dashboard, /<div className="client-topbar-actions"><ClientNotifications/);
  assert.match(dashboard, /client-topbar-points/); assert.match(dashboard, /formatClientPoints\(client\?\.points\)/);
  assert.doesNotMatch(overview, /<aside className="client-home-focus-side">/);
  assert.match(css, /\.client-topbar-points\{[^}]*background:#f2ebff/);
  assert.match(dashboard, /orderedBookings/); assert.match(dashboard, /تغيير الموعد/); assert.match(dashboard, /إلغاء/);
  assert.match(dashboard, /الوقت من/); assert.match(dashboard, /الوقت إلى/); assert.doesNotMatch(dashboard, /window\.confirm/);
  assert.ok((dashboard.match(/تم إرسال الطلب/g) || []).length >= 3);
  assert.match(finance, /client-pay-now/); assert.match(finance, /إنستاباي/); assert.match(finance, /فودافون كاش/); assert.match(finance, /01114466646/); assert.match(finance, /01094084424/); assert.match(finance, /navigator\.clipboard\.writeText/); assert.match(finance, /accept="image\/jpeg,image\/png,image\/webp,application\/pdf"/);
  assert.match(offers, /ClientPublicPromotions/); assert.match(offers, /اشترك الآن/); assert.match(css, /client-home-focus-grid/); assert.match(css, /client-appointment-cards/);
});

test('demo promotion subscription is exact-once and creates one owner notification per owner', async () => {
  const storage = setupBrowser();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const list = await demoClient.request('/client/promotions', { method: 'GET' });
  assert.equal(list.error, null); assert.ok(list.data.items.length >= 1); assert.equal(Number(list.data.items[0].subscribed), 0);
  const promotionId = list.data.items[0].id;
  const first = await demoClient.request(`/client/promotions/${promotionId}/subscribe`, { method: 'POST', body: '{}' });
  const replay = await demoClient.request(`/client/promotions/${promotionId}/subscribe`, { method: 'POST', body: '{}' });
  assert.equal(first.error, null); assert.equal(first.data.already_subscribed, false); assert.equal(replay.data.already_subscribed, true);
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.equal(database.promotion_subscriptions.filter(row => Number(row.promotion_id) === Number(promotionId) && Number(row.client_id) === 1).length, 1);
  assert.equal(database.app_notifications.filter(row => row.type === 'client_promotion_interest' && Number(row.entity_id) === Number(first.data.id)).length, 2);
  deactivateDemoMode();
});

test('payment proof stores the selected transfer method and immutable destination snapshot', async () => {
  const storage = setupBrowser();
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('client');
  const result = await demoClient.request('/payment-proofs', { method: 'POST', body: JSON.stringify({ client_package_id: 201, amount: 250, payment_method: 'vodafone_cash' }) });
  assert.equal(result.error, null); assert.equal(result.data.payment_method, 'vodafone_cash'); assert.equal(result.data.transfer_account_snapshot, '01094084424');
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const proof = database.payment_proofs.find(row => Number(row.id) === Number(result.data.id));
  assert.equal(proof.transfer_account_snapshot, '01094084424');
  deactivateDemoMode();
});

test('production and migration keep client promotions scoped and payment destinations server-owned', async () => {
  const [api, migration] = await Promise.all([load('api/index.php'), load('database/mysql/030_client_dashboard_payment_promotions.sql')]);
  assert.match(api, /\/client\/promotions/); assert.match(api, /p\.organization_id=\?/); assert.match(api, /promotion_subscriptions/); assert.match(api, /client_promotion_interest/);
  assert.match(api, /'instapay'=>'01114466646'/); assert.match(api, /'vodafone_cash'=>'01094084424'/); assert.match(api, /transfer_account_snapshot/);
  assert.match(migration, /UNIQUE KEY uq_promotion_client/); assert.match(migration, /FOREIGN KEY \(promotion_id\)/); assert.match(migration, /FOREIGN KEY \(client_id\)/);
});
