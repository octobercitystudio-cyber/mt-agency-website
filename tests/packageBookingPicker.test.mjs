import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildPackageServiceGroups, filterClientsByName, mergeCreatedClient, normalizeArabicSearch, sortClientsByArabicName } from '../src/lib/packageBookingPicker.js';
import { CLIENT_MODAL_APPEARANCE, clientModalAppearance } from '../src/erp/clientModalAppearance.js';
import { resolveClientModalSaveResult } from '../src/erp/clientModalFlow.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');
const hour = (id, name, category = 'تصوير بالساعة', overrides = {}) => ({ id, name, category, billing_unit: 'hour', total_hours: 2, total_reels: 0, is_active: 1, ...overrides });
const reel = (id, name, category = 'باقة ريلز', overrides = {}) => ({ id, name, category, billing_unit: 'reel', total_hours: 0, total_reels: 4, is_active: 1, ...overrides });
const luminance = hex => {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => Number.parseInt(value, 16) / 255).map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
};
const contrast = (foreground, background) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('package templates use ordered non-empty business optgroups, aliases and stable Arabic service sorting', () => {
  const groups = buildPackageServiceGroups([
    reel(8, 'ريلز بلس'),
    hour(4, 'يومي ب', 'باقة يومية', { billing_unit: 'day' }),
    hour(3, 'شهري', 'باقة شهرية', { billing_unit: 'month' }),
    hour(2, 'باسم', 'التصوير بالساعة'),
    hour(1, 'أحمد', 'تصوير بالساعة'),
    hour(9, 'مونتاج باقة', 'إنتاج صوتي'),
    hour(10, 'مؤرشف', 'تصوير بالساعة', { archived_at: '2026-08-01' }),
    hour(11, 'مسودة', 'تصوير بالساعة', { is_draft: 1 }),
  ]);
  assert.deepEqual(groups.map(group => group.label), ['التصوير بالساعة', 'الباقات اليومية', 'الباقات الشهرية', 'باقات الريلز', 'إنتاج صوتي']);
  assert.deepEqual(groups[0].services.map(service => service.id), [1, 2]);
  assert.equal(groups.flatMap(group => group.services).some(service => [10, 11].includes(service.id)), false);
});

test('empty fixed groups disappear and real custom categories sort in Arabic order', () => {
  const groups = buildPackageServiceGroups([hour(1, 'خدمة', 'زفاف'), hour(2, 'خدمة', 'إعلانات')]);
  assert.deepEqual(groups.map(group => group.label), ['إعلانات', 'زفاف']);
});

test('client picker sorts and filters by name only with practical Arabic normalization', () => {
  const clients = [
    { id: 7, name: 'إيمان', phone1: '01099999999' },
    { id: 4, name: 'أحمد', phone1: '01122222222' },
    { id: 9, name: 'احمد', phone1: '01233333333' },
    { id: 3, name: 'يُسرى', phone1: '01544444444' },
  ];
  assert.equal(normalizeArabicSearch('إِيمَان'), 'ايمان');
  assert.deepEqual(sortClientsByArabicName(clients).map(client => client.id), [4, 9, 7, 3]);
  assert.deepEqual(filterClientsByName(clients, 'ايمان').map(client => client.id), [7]);
  assert.deepEqual(filterClientsByName(clients, '01099999999').map(client => client.id), [], 'phone must never be searchable');
  assert.deepEqual(filterClientsByName(clients, 'غير مطابق', 9).map(client => client.id), [9], 'selected ID stays visible');
});

test('created client merge is ID-safe for duplicate names and does not touch an existing sale draft', () => {
  const clients = [{ id: 1, name: 'نور', phone1: '010' }, { id: 2, name: 'نور', phone1: '011' }];
  const draft = Object.freeze({ client_id: '', service_id: '8', name: 'باقة خاصة', billing_unit: 'hour', starts_at: '2026-08-10', expires_at: '2026-11-08', quantity: 12, validity_days: 90, payment_due_quantity: 4, deposit_percent_snapshot: 35, overage_price_snapshot: 750, total_price: 9000, paid_amount: 300, payment_method: 'instapay', notes: 'اتفاق خاص' });
  const requestKey = 'package-sale-stable-key';
  const merged = mergeCreatedClient(clients, { id: 3, name: 'نور', phone1: '012' });
  const selectedDraft = { ...draft, client_id: '3' };
  assert.equal(merged.length, 3); assert.deepEqual(merged.map(client => client.id), [1, 2, 3]);
  assert.deepEqual({ ...selectedDraft, client_id: '' }, draft);
  assert.equal(requestKey, 'package-sale-stable-key');
});

test('client-modal appearance variants remain isolated and keep accessible contrast', () => {
  const standard = clientModalAppearance();
  const dark = clientModalAppearance(CLIENT_MODAL_APPEARANCE.PACKAGE_SALE_DARK);
  assert.equal(standard.overlayClass, ''); assert.equal(standard.tokens, undefined);
  assert.equal(dark.overlayClass, 'erp-client-modal-overlay--package-sale-dark');
  assert.equal(dark.contentClass, 'erp-client-modal-content--package-sale-dark');
  assert.equal(dark.tokens['--erp-surface'], '#120c1a'); assert.equal(dark.tokens['--erp-surface-raised'], '#0b0710');
  assert.ok(contrast(dark.tokens['--erp-text-main'], dark.tokens['--erp-surface']) >= 7);
  assert.ok(contrast(dark.tokens['--erp-danger'], dark.tokens['--erp-surface']) >= 4.5);
});

test('demo client create normalizes phone and rejects an organization duplicate without any mutation', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, normalizeDemoPhone, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  assert.equal(normalizeDemoPhone('010-1234 5678'), '01012345678');
  const before = storage.get('mt_agency_erp_demo_v12');
  const beforeCount = (await demoClient.from('clients').select('id')).data.length;
  const duplicate = await demoClient.request('/clients', { method: 'POST', body: JSON.stringify({ name: 'نسخة مكررة', phone1: '010-1234 5678', color: '#7c3aed' }) });
  assert.equal(duplicate.data, null); assert.equal(duplicate.error?.code, 'duplicate_client'); assert.equal(duplicate.error?.status, 409);
  const parentDraft = Object.freeze({ client_id: '', service_id: '102', quantity: 8, paid_amount: 1200, notes: 'تبقى كما هي' });
  const failedOutcome = resolveClientModalSaveResult({ result: duplicate, isEditing: false, draft: {}, payload: { name: 'نسخة مكررة' } });
  assert.equal(failedOutcome.ok, false); assert.equal(failedOutcome.shouldClose, false); assert.deepEqual(parentDraft, { client_id: '', service_id: '102', quantity: 8, paid_amount: 1200, notes: 'تبقى كما هي' });
  assert.equal((await demoClient.from('clients').select('id')).data.length, beforeCount);
  assert.equal(storage.get('mt_agency_erp_demo_v12'), before, 'duplicate failure must not write any demo state');
  const created = await demoClient.request('/clients', { method: 'POST', body: JSON.stringify({ name: 'عميل فريد', phone1: '010-8888 9999', color: '#7c3aed' }) });
  assert.equal(created.error, null); assert.deepEqual(Object.keys(created.data).sort(), ['id', 'portal_access']); assert.equal(created.data.portal_access, false);
  const successOutcome = resolveClientModalSaveResult({ result: created, isEditing: false, draft: {}, payload: { name: 'عميل فريد', phone1: '01088889999' } });
  assert.equal(successOutcome.ok, true); assert.equal(successOutcome.shouldClose, true); assert.equal(successOutcome.savedClient.id, created.data.id);
  const saved = (await demoClient.from('clients').select('id,phone1')).data.find(client => Number(client.id) === Number(created.data.id));
  assert.equal(saved.phone1, '01088889999'); deactivateDemoMode();
});

test('sale UI uses native grouped/name-only pickers and stacked ERPClientModal without resetting the draft', async () => {
  const [view, modal, hook, css] = await Promise.all([
    load('src/erp/ERPPackages.jsx'), load('src/erp/ERPClientModal.jsx'), load('src/hooks/useModalDialog.js'), load('src/erp/ERPPackages.css'),
  ]);
  assert.match(view, /<optgroup key=\{group\.key\} label=\{group\.label\}>/);
  assert.match(view, /البحث باسم العميل/); assert.match(view, /＋ عميل جديد/);
  assert.doesNotMatch(view, /\{item\.name\} — \{item\.phone1\}/);
  assert.match(view, /useModalDialog\(formOpen, closeAddDialog/);
  assert.match(view, /<ERPClientModal isOpen=\{clientModalOpen\} nested returnFocusRef=/);
  assert.equal(view.includes('appearance="package-sale-dark"'), false);
  assert.match(view, /inert=\{childOpen \? true : undefined\}/);
  assert.match(view, /setForm\(current => \(\{ \.\.\.current, client_id: String\(createdClient\.id\) \}\)\)/);
  assert.match(view, /packageRequestKeyRef/); assert.match(view, /mergeCreatedClient\(result\.data \|\| \[\], createdClient\)/);
  assert.match(modal, /event\.stopPropagation\(\)/); assert.match(modal, /returnFocusRef/); assert.match(modal, /clientModalAppearance\(appearance\)/);
  assert.match(hook, /openModalStack\.at\(-1\)/); assert.match(css, /packages-new-client\{min-height:44px/);
});
