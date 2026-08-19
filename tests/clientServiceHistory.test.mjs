import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';
import { isUnfulfilledServiceHistoryType, serviceHistoryEmptyMode } from '../src/lib/clientServiceHistory.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
} });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });

test.beforeEach(() => { storage.clear(); activateDemoMode('client'); resetDemoDatabase(); });
test.afterEach(() => deactivateDemoMode());

test('client service history is client-scoped, unified, and excludes active work and commercial documents', async () => {
  const response = await demoClient.request('/client/service-history?type=all&sort=desc&page_size=50', { method: 'GET' });
  assert.equal(response.error, null);
  const items = response.data.items;
  assert.deepEqual(new Set(items.map(item => item.type)), new Set(['studio_session', 'ended_package', 'completed_project']));
  assert.equal(items.some(item => item.title.includes('كورس سابق')), false, 'another client session must stay private');
  assert.equal(items.some(item => item.title.includes('إطلاق مجموعة الصيف')), false, 'active projects stay out of history');
  assert.equal(items.some(item => item.type === 'offer' || item.type === 'invoice'), false);
  assert.deepEqual(response.data.summary, { completed_sessions: 1, ended_packages: 1, completed_projects: 1, history_total: 5 });
});

test('history exposes exact client-safe duration, quantity, finance, milestones, and no hidden fields', async () => {
  const { data } = await demoClient.request('/client/service-history?page_size=50', { method: 'GET' });
  const session = data.items.find(item => item.id === 'studio_session:307');
  assert.equal(session.details.actual_minutes, 105);
  assert.equal(session.details.deducted_quantity, 1.75);
  assert.equal(session.details.excess_minutes, 0);
  const pkg = data.items.find(item => item.id === 'ended_package:208');
  assert.deepEqual({ total: pkg.details.total_quantity, used: pkg.details.used_quantity, remaining: pkg.details.final_remaining }, { total: 6, used: 6, remaining: 0 });
  assert.deepEqual({ total: pkg.details.total_price, paid: pkg.details.paid_amount, due: pkg.details.due_amount }, { total: 6500, paid: 6500, due: 0 });
  const project = data.items.find(item => item.id === 'completed_project:1119');
  assert.equal(project.details.completed_milestones.length, 3);
  assert.equal(project.details.completed_items.length, 1);
  assert.deepEqual({ agreement: project.details.agreement_amount, paid: project.details.paid_amount, due: project.details.due_amount }, { agreement: 24000, paid: 24000, due: 0 });
  const serialized = JSON.stringify(data);
  for (const hidden of ['started_by', 'ended_by', 'created_by', 'internal_cost', 'internal_note', 'internal_reason', 'adjustment_reason', 'audit_logs', 'server_path', 'notes']) assert.equal(serialized.includes(hidden), false, `${hidden} must stay hidden`);
});

test('history filters search, time, sort, pagination, and unfulfilled entries deterministically', async () => {
  const search = await demoClient.request('/client/service-history?query=الشتاء&page_size=50', { method: 'GET' });
  assert.equal(search.data.items.length, 2);
  const sessions = await demoClient.request('/client/service-history?type=studio_session&page_size=50', { method: 'GET' });
  assert.deepEqual(sessions.data.items.map(item => item.type), ['studio_session']);
  const none = await demoClient.request('/client/service-history?from=2099-01-01&page_size=50', { method: 'GET' });
  assert.equal(none.data.items.length, 0);
  const asc = await demoClient.request('/client/service-history?sort=asc&page_size=50', { method: 'GET' });
  const desc = await demoClient.request('/client/service-history?sort=desc&page_size=50', { method: 'GET' });
  assert.deepEqual(asc.data.items.map(item => item.id), desc.data.items.map(item => item.id).reverse());
  const page = await demoClient.request('/client/service-history?page=2&page_size=1', { method: 'GET' });
  assert.equal(page.data.items.length, 1);
  assert.equal(page.data.pagination.page, 2);
  assert.equal(page.data.pagination.total, 3);
  const unfulfilled = await demoClient.request('/client/service-history?type=unfulfilled&page_size=50', { method: 'GET' });
  assert.deepEqual(new Set(unfulfilled.data.items.map(item => item.type)), new Set(['cancelled_booking', 'cancelled_project']));
  assert.equal(unfulfilled.data.items.every(item => item.unfulfilled), true);
});

test('zero covered minutes remain authoritative for all-excess or waived demo settlements', async () => {
  const database = JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  database.session_settlements = [{
    id: 9901, booking_session_id: 1601, booking_id: 307, client_id: 1,
    actual_minutes: 120, covered_minutes: 0, excess_minutes: 120, billable_minutes: 0,
    waived_minutes: 120, settlement_mode: 'waive', amount_due: 0, amount_paid: 0,
    client_note: 'تم التغاضي عن الوقت كاملًا', internal_reason: 'internal-only', created_by: 1,
  }];
  storage.set('mt_agency_erp_demo_v12', JSON.stringify(database));
  const response = await demoClient.request('/client/service-history?type=studio_session&page_size=50', { method: 'GET' });
  assert.equal(response.error, null);
  const session = response.data.items.find(item => item.id === 'studio_session:307');
  assert.equal(session.details.actual_minutes, 120);
  assert.equal(session.details.deducted_quantity, 0);
  assert.equal(session.details.excess_minutes, 120);
  assert.equal(JSON.stringify(session).includes('internal-only'), false);
  const api = await load('api/index.php');
  const route = api.slice(api.indexOf("if ($path === '/client/service-history'"), api.indexOf("if ($path === '/client/projects'"));
  assert.match(route, /\$row\['covered_minutes'\]!==null\?\(float\)\$row\['covered_minutes'\]\/60/);
});

test('default one-year view distinguishes a truly empty archive from a filtered miss', async () => {
  assert.equal(serviceHistoryEmptyMode({ historyTotal: 0, filteredTotal: 0 }), 'empty');
  assert.equal(serviceHistoryEmptyMode({ historyTotal: 3, filteredTotal: 0 }), 'filtered');
  assert.equal(serviceHistoryEmptyMode({ historyTotal: 3, filteredTotal: 2 }), 'populated');
  const view = await load('src/pages/ClientServiceHistory.jsx');
  assert.match(view, /historyTotal: data\.summary\?\.history_total/);
  assert.match(view, /emptyMode === 'filtered' \? 'لا توجد نتائج مطابقة' : 'سجل الخدمات فارغ حاليًا'/);
});

test('cancelled history entries use unfulfilled icon semantics instead of a completion check', async () => {
  assert.equal(isUnfulfilledServiceHistoryType('cancelled_booking'), true);
  assert.equal(isUnfulfilledServiceHistoryType('cancelled_project'), true);
  assert.equal(isUnfulfilledServiceHistoryType('studio_session'), false);
  const view = await load('src/pages/ClientServiceHistory.jsx');
  assert.match(view, /const StatusIcon = isUnfulfilledServiceHistoryType\(item\.type\) \? Ban : CheckCircle2/);
  assert.match(view, /<StatusIcon aria-hidden="true" \/>/);
  assert.doesNotMatch(view, /client-history-status[^\n]*<CheckCircle2/);
});

test('demo and production contracts reject staff access and derive client scope from the session', async () => {
  activateDemoMode('owner');
  const denied = await demoClient.request('/client/service-history?client_id=2', { method: 'GET' });
  assert.equal(denied.error?.code, 'forbidden');
  const api = await load('api/index.php');
  const start = api.indexOf("if ($path === '/client/service-history'");
  const end = api.indexOf("if ($path === '/client/projects'", start);
  const route = api.slice(start, end);
  assert.match(route, /requireRole\(\$user,\['client'\]\)/);
  assert.match(route, /\$clientId=\(int\)\$user\['client_id'\]/);
  assert.doesNotMatch(route, /\$_GET\['client_id'\]/);
  for (const hidden of ['started_by', 'ended_by', 'created_by', 'internal_cost', 'internal_note', 'adjustment_reason', 'audit_logs']) assert.equal(route.includes(`'${hidden}'`), false, `${hidden} must not be selected or returned`);
});

test('client navigation exposes offers directly while Home keeps simple shortcuts', async () => {
  const [dashboard, overview, css, view] = await Promise.all([
    load('src/pages/ClientDashboard.jsx'), load('src/pages/ClientDashboardOverview.jsx'), load('src/pages/ClientDashboard.css'), load('src/pages/ClientServiceHistory.jsx'),
  ]);
  const navigation = dashboard.slice(dashboard.indexOf("['home', Home"), dashboard.indexOf('].map(([key, Icon, label])'));
  assert.doesNotMatch(navigation, /'history'|'projects'/);
  assert.match(overview, /onNavigate\('offers'\)/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css, /@media\(max-width:800px\)[\s\S]*\.client-nav-security\{display:none\}[\s\S]*\.client-nav-more\{display:flex\}/);
  assert.match(view, /سجل الخدمات/);
  assert.match(view, /كل ما تم تنفيذه أو تسليمه لك في مكان واحد/);
  assert.match(view, /<details><summary>عرض التفاصيل<\/summary>/);
});

test('client primary navigation is exactly home, appointments, finance, and offers', async () => {
  const [dashboard, css] = await Promise.all([load('src/pages/ClientDashboard.jsx'), load('src/pages/ClientDashboard.css')]);
  const navigation = dashboard.slice(dashboard.indexOf("['home', Home"), dashboard.indexOf('].map(([key, Icon, label])'));
  assert.match(navigation, /\['offers', Megaphone, 'العروض'\]/);
  assert.doesNotMatch(navigation, /'projects'|'history'|'أعمالي'/);
  assert.equal((navigation.match(/\['(?:home|schedule|finance|offers)'/g) || []).length, 4);
  assert.match(dashboard, /aria-label=\{label\} title=\{label\}/);
  assert.match(dashboard, /activeTab === 'projects'/);
  assert.match(dashboard, /navigateClient\(key\)/);
  assert.match(css, /@media\(min-width:681px\) and \(max-width:800px\)/);
  assert.match(css, /@media\(max-width:340px\)/);
});
