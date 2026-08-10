import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CUSTOM_CATEGORY_VALUE,
  activeServiceCategories,
  applyCategoryDefaults,
  buildServiceCategoryGroups,
  categoryCustomValue,
  categoryEditorValue,
  resolveServiceCategory,
} from '../src/lib/serviceCategories.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const storage = new Map();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key), clear: () => storage.clear() } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
if (!globalThis.CustomEvent) globalThis.CustomEvent = class CustomEvent extends Event { constructor(type, options = {}) { super(type); this.detail = options.detail; } };

test('fixed, project and custom category contracts produce the intended payload', () => {
  assert.deepEqual(resolveServiceCategory('جرافيك'), { category: 'جرافيك', error: '' });
  assert.equal(applyCategoryDefaults({ billing_unit: 'hour', auto_start_timer: 1, total_hours: 4 }, 'مونتاج').billing_unit, 'project');
  assert.equal(applyCategoryDefaults({ billing_unit: 'hour', auto_start_timer: 1 }, 'مونتاج').auto_start_timer, 0);
  assert.deepEqual(resolveServiceCategory(CUSTOM_CATEGORY_VALUE, '  إدارة   المحتوى  '), { category: 'إدارة المحتوى', error: '' });
  assert.match(resolveServiceCategory(CUSTOM_CATEGORY_VALUE, 'خدمة إضافية').error, /متوقف|محجوز/);
  assert.match(resolveServiceCategory(CUSTOM_CATEGORY_VALUE, '!').error, /حرف|واضح/);
});

test('legacy categories edit as custom and remain discoverable without hiding archived rows', () => {
  assert.equal(categoryEditorValue('خدمة إضافية'), CUSTOM_CATEGORY_VALUE);
  assert.equal(categoryCustomValue('خدمة إضافية'), 'خدمة إضافية');
  const services = [{ id: 1, category: 'جرافيك', is_active: 1 }, { id: 2, category: 'تصنيف قديم', is_active: 0, archived_at: '2026-08-10' }];
  assert.ok(buildServiceCategoryGroups(services).find(group => group.value === 'تصنيف قديم')?.services.length === 1);
  assert.equal(activeServiceCategories(services).some(group => group.value === 'تصنيف قديم'), false);
});

test('settings and booking entry points have dynamic categories and no retired static choice', async () => {
  const [settings, bookingModal, bookings] = await Promise.all([load('src/erp/ERPSettings.jsx'), load('src/erp/ERPAddBookingModal.jsx'), load('src/erp/ERPBookings.jsx')]);
  assert.match(settings, /actionLabel="حذف الخدمة"/);
  assert.match(settings, /اسم التصنيف المخصص/);
  assert.match(settings, /FIXED_SERVICE_CATEGORIES\.map/);
  assert.doesNotMatch(settings, /خدمات إضافية \(جرافيك وغيرها\)/);
  for (const source of [bookingModal, bookings]) {
    assert.match(source, /activeServiceCategories/);
    assert.doesNotMatch(source, /<option value="خدمة إضافية">/);
  }
});

test('service dialogs use the shared accessible modal contract without Bootstrap globals', async () => {
  const settings = await load('src/erp/ERPSettings.jsx');

  assert.match(settings, /useModalDialog\(serviceModal === 'add'/);
  assert.match(settings, /useModalDialog\(serviceModal === 'edit'/);
  assert.match(settings, /ref=\{addServiceDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(settings, /ref=\{editServiceDialogRef\}[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(settings, /data-dialog-initial data-service-initial/);
  assert.match(settings, /serviceModal === 'add'[\s\S]*?onMouseDown=\{event => event\.target === event\.currentTarget && setServiceModal\(null\)\}/);
  assert.match(settings, /serviceModal === 'edit' && <div className="erp-modal-overlay service-form-overlay">/);
  assert.doesNotMatch(settings, /getOrCreateInstance\(document\.getElementById\('editServiceModal'\)\)/);
  assert.doesNotMatch(settings, /id="(?:add|edit)ServiceModal"/);
});

test('service row impact action is neutral while the final dialog actions keep semantic tones', async () => {
  const css = await load('src/erp/OwnerRecordActions.css');
  const neutralTrigger = css.match(/\.owner-record-actions \.owner-impact\{([^}]*)\}/)?.[1] || '';

  assert.match(neutralTrigger, /color:#334155/);
  assert.match(neutralTrigger, /border-color:#cbd5e1/);
  assert.doesNotMatch(neutralTrigger, /#(?:9f1239|be123c|fecdd3|fff1f2)/);
  assert.match(css, /\.owner-action-dialog footer button\.danger\{background:#be123c;color:#fff\}/);
  assert.match(css, /\.owner-action-dialog footer button\.archive\{background:#a16207;color:#fff\}/);
  assert.match(css, /\.owner-action-dialog--archive \.owner-impact-decision>svg\{color:#a16207\}/);
});

test('server service impact counts settlement allocations and allows zero-link hard delete regardless draft', async () => {
  const api = await load('api/index.php');
  assert.match(api, /session_settlement_allocations a JOIN session_settlements s/);
  assert.match(api, /\$safe=array_sum\(\$links\)===0/);
  assert.doesNotMatch(api, /\$safe=!empty\(\$record\['is_draft'\]\)&&array_sum\(\$links\)===0/);
  assert.match(api, /JOIN services s ON s\.id=cp\.service_id AND s\.organization_id=cp\.organization_id WHERE cp\.id/);
});

test('demo enforces owner role, project defaults, hard-delete/archive decision and legacy editing', async () => {
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  storage.clear(); resetDemoDatabase(); activateDemoMode('admin');
  const denied = await demoClient.request('/services', { method: 'POST', body: JSON.stringify({ name: 'هوية بصرية', category: 'جرافيك', price: 5000, reason: 'اختبار منع المدير' }) });
  assert.equal(denied.error?.code, 'forbidden');

  activateDemoMode('owner');
  const created = await demoClient.request('/services', { method: 'POST', body: JSON.stringify({ name: 'هوية بصرية', category: 'جرافيك', billing_unit: 'hour', auto_start_timer: 1, price: 5000, reason: 'إضافة خدمة للاختبار' }) });
  assert.equal(created.error, null); assert.equal(created.data.billing_unit, 'project'); assert.equal(created.data.auto_start_timer, 0);
  const impact = await demoClient.request(`/owner/records/services/${created.data.id}/impact`, { method: 'GET' });
  assert.equal(impact.error, null); assert.equal(impact.data.action, 'hard_delete');
  const removed = await demoClient.request(`/owner/records/services/${created.data.id}/action`, { method: 'POST', body: JSON.stringify({ reason: 'حذف خدمة غير مستخدمة', confirmation: 'حذف', expected_action: 'hard_delete', version: created.data.version }) });
  assert.equal(removed.error, null); assert.equal(removed.data.action, 'hard_delete');

  const linked = await demoClient.request('/owner/records/services/101/impact', { method: 'GET' });
  assert.equal(linked.data.action, 'archive'); assert.ok(linked.data.total_links > 0);
  const legacy = await demoClient.request('/services/104', { method: 'PATCH', body: JSON.stringify({ name: 'إدارة سوشيال ميديا مطورة', category: 'خدمة إضافية', reason: 'تحديث اسم القالب القديم' }) });
  assert.equal(legacy.error, null); assert.equal(legacy.data.category, 'خدمة إضافية');
  const retiredNew = await demoClient.request('/services', { method: 'POST', body: JSON.stringify({ name: 'خدمة قديمة', category: 'خدمة إضافية', price: 1, reason: 'محاولة تصنيف متوقف' }) });
  assert.equal(retiredNew.error?.code, 'invalid_service_category');
  deactivateDemoMode();
});
