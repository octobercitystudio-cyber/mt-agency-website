import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_COLOR_PALETTE, nextClientColor, normalizeClientColor } from '../src/lib/clientColors.js';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('automatic client colors are normalized and never repeat an existing color', () => {
  assert.equal(normalizeClientColor(' #0ea5e9 '), '#0EA5E9');
  assert.equal(normalizeClientColor('blue'), null);
  assert.equal(nextClientColor([]), CLIENT_COLOR_PALETTE[0]);

  const generated = nextClientColor(CLIENT_COLOR_PALETTE);
  assert.match(generated, /^#[0-9A-F]{6}$/);
  assert.equal(CLIENT_COLOR_PALETTE.includes(generated), false);
  assert.notEqual(nextClientColor([...CLIENT_COLOR_PALETTE, generated]), generated);
});

test('demo clients receive distinct automatic colors and still accept a manual color', async () => {
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class CustomEvent { constructor(type) { this.type = type; } };
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase();
  activateDemoMode('owner');

  const before = (await demoClient.from('clients').select('color')).data.map(client => normalizeClientColor(client.color)).filter(Boolean);
  const preview = await demoClient.request('/clients/next-color');
  const first = await demoClient.request('/clients', { method: 'POST', body: JSON.stringify({ name: 'عميل تلقائي أول', phone1: '01070000001', color: null }) });
  const second = await demoClient.request('/clients', { method: 'POST', body: JSON.stringify({ name: 'عميل تلقائي ثان', phone1: '01070000002' }) });
  const manual = await demoClient.request('/clients', { method: 'POST', body: JSON.stringify({ name: 'عميل يدوي', phone1: '01070000003', color: '#123456' }) });
  const invalid = await demoClient.request('/clients', { method: 'POST', body: JSON.stringify({ name: 'لون خاطئ', phone1: '01070000004', color: 'red' }) });

  assert.equal(first.error, null);
  assert.equal(first.data.color, preview.data.color);
  assert.equal(before.includes(first.data.color), false);
  assert.notEqual(second.data.color, first.data.color);
  assert.equal(manual.data.color, '#123456');
  assert.equal(invalid.error?.code, 'invalid_client_color');
  deactivateDemoMode();
});

test('production route locks auto assignment and the client form preserves manual override', async () => {
  const [api, modal, css] = await Promise.all([
    load('api/index.php'),
    load('src/erp/ERPClientModal.jsx'),
    load('src/erp/ERPClientModal.css'),
  ]);

  assert.match(api, /function nextClientColor\(PDO \$pdo,int \$organizationId\)/);
  assert.match(api, /\/clients\/next-color/);
  assert.match(api, /SELECT id FROM organizations WHERE id=\? FOR UPDATE/);
  assert.match(api, /\$color=\$manualColor\?\?nextClientColor/);
  assert.match(api, /'color'=>\$color/);
  assert.match(modal, /colorEditedRef/);
  assert.match(modal, /dataClient\.request\('\/clients\/next-color'/);
  assert.match(modal, /color: isEditing \|\| colorEditedRef\.current \? draft\.color : null/);
  assert.match(modal, /type="color"/);
  assert.match(modal, /لون مختلف يُختار تلقائيًا عند الحفظ/);
  assert.match(css, /\.erp-client-color-note\.is-auto/);
});
