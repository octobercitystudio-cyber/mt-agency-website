import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('booking modal offers new-client registration without replacing the booking draft', async () => {
  const source = await load('src/erp/ERPAddBookingModal.jsx');

  assert.match(source, /const NEW_CLIENT_OPTION = '__create_new_client__'/);
  assert.match(source, /＋ تسجيل عميل جديد/);
  assert.match(source, /if \(value === NEW_CLIENT_OPTION\) \{\s*setIsClientModalOpen\(true\);\s*return;/);
  assert.match(source, /<ERPClientModal/);
  assert.match(source, /onClose=\{\(\) => setIsClientModalOpen\(false\)\}/);
  assert.doesNotMatch(source, /onClose=\{\(\) => \{[^}]*setNewBooking/);
});

test('created client is resolved by id, selected, and keeps the database color', async () => {
  const source = await load('src/erp/ERPAddBookingModal.jsx');

  assert.match(source, /resolveCreatedBookingClient\(nextClients, savedClient\)/);
  assert.match(source, /applyBookingClientToDraft\(current, createdClient\)/);
  assert.match(source, /clients\.find\(item=>String\(item\.id\)===String\(newBooking\.client_id\)\)/);
  assert.doesNotMatch(source, /type="color" value=\{newBooking\.color\}/);
});

test('a created client keeps a non-default saved color through refresh, selection, and indicator rendering', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const [{ activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase }, selection] = await Promise.all([
    import('../src/lib/demoDataClient.js'),
    import('../src/erp/bookingClientSelection.js'),
  ]);
  resetDemoDatabase();
  activateDemoMode('owner');
  const saved = await demoClient.request('/clients', {
    method: 'POST',
    body: JSON.stringify({ name: 'عميل اللون السماوي', phone1: '01012345678', color: '#0ea5e9' }),
  });
  assert.equal(saved.error, null);
  const refreshed = await demoClient.from('clients').select('id,name,color');
  assert.equal(refreshed.error, null);
  const created = selection.resolveCreatedBookingClient(refreshed.data, saved.data);
  const draft = selection.applyBookingClientToDraft({ category: 'باقة ريلز', notes: 'مسودة محفوظة' }, created);
  const indicator = selection.bookingClientIndicatorStyle(draft.color);
  assert.equal(draft.client_id, saved.data.id);
  assert.equal(draft.color, '#0ea5e9');
  assert.equal(indicator.background, '#0ea5e9');
  assert.equal(draft.category, 'باقة ريلز');
  assert.equal(draft.notes, 'مسودة محفوظة');
  deactivateDemoMode();
});

test('shared client modal returns the saved client without breaking existing callbacks', async () => {
  const source = await load('src/erp/ERPClientModal.jsx');

  assert.match(source, /const savedClient = \{ \.\.\.payload, \.\.\.\(result\.data \|\| \{\}\), id: result\.data\?\.id \|\| draft\.id \}/);
  assert.match(source, /await onSuccess\?\.\(savedClient\)/);
  assert.match(source, /returnFocusRef/);
  assert.match(source, /event\.stopPropagation\(\)/);
});

test('modal dialog hook only lets the topmost nested dialog handle Escape and Tab', async () => {
  const source = await load('src/hooks/useModalDialog.js');

  assert.match(source, /const openModalStack = \[\]/);
  assert.match(source, /if \(openModalStack\.at\(-1\) !== modalToken\) return/);
  assert.match(source, /openModalStack\.splice\(stackIndex, 1\)/);
});

test('nested client close target and mobile booking context stay accessible', async () => {
  const [clientModal, clientCss, bookingModal] = await Promise.all([
    load('src/erp/ERPClientModal.jsx'),
    load('src/erp/ERPClientModal.css'),
    load('src/erp/ERPAddBookingModal.jsx'),
  ]);
  assert.match(clientModal, /className="erp-client-modal-close"/);
  assert.match(clientCss, /\.erp-client-modal-close\s*\{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;/);
  assert.match(clientCss, /\.erp-client-modal-close:focus-visible/);
  assert.match(bookingModal, /className="erp-booking-modal-header"/);
  assert.match(bookingModal, /position: 'sticky', top: 0/);
});
