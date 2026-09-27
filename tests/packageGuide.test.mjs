import assert from 'node:assert/strict';
import test from 'node:test';
import { PACKAGE_BOOKING_TERMS } from '../src/lib/packageBookingTerms.js';

test('owner guide publishes to clients, isolates revisions and keeps real prices and fixed policy', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class {};
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  await resetDemoDatabase(); activateDemoMode('owner', 1, 1);
  const read = () => demoClient.request('/package-guide');
  const save = body => demoClient.request('/package-guide', { method: 'PUT', body: JSON.stringify(body) });
  const initial = (await read()).data;
  assert.equal(initial.revision, 0); assert.ok(initial.services.length); assert.deepEqual(initial.booking_terms, PACKAGE_BOOKING_TERMS);
  const body = { expected_revision: 0, content: { ...initial.content, title: 'دليل استديو محدث' } };
  const saved = (await save(body)).data; assert.equal(saved.revision, 1);
  assert.equal((await save(body)).data.revision, 1);
  assert.equal((await save({ ...body, content: { ...body.content, title: 'قديم' } })).error.code, 'guide_revision_conflict');
  for (const role of ['client', 'admin', 'operations']) {
    activateDemoMode(role, 1, 1); assert.equal((await read()).data.content.title, body.content.title);
    assert.equal((await save({ ...body, expected_revision: 1 })).error.code, 'forbidden');
  }
  activateDemoMode('client', 1, 1);
  assert.ok((await demoClient.request('/sync?cursor=0')).data.topics.includes('services'));
  activateDemoMode('owner', 1, 2); assert.equal((await read()).data.revision, 0);
  activateDemoMode('owner', 1, 1);
  for (const invalid of [{ booking_policy: 'changed' }, { services: [] }, { title: '' }, { delivery_options: [] }]) {
    assert.equal((await save({ expected_revision: 1, content: { ...saved.content, ...invalid } })).error.code, 'invalid_package_guide');
  }
  const db = JSON.parse(storage.get('mt_agency_erp_demo_v12')); const service = db.services.find(row => Number(row.id) === Number(initial.services[0].id)); service.price = 4321;
  storage.set('mt_agency_erp_demo_v12', JSON.stringify(db));
  const current = (await read()).data; assert.equal(current.services.find(row => Number(row.id) === Number(service.id)).price, 4321);
  assert.deepEqual(current.booking_terms, PACKAGE_BOOKING_TERMS);
  await assert.rejects(async () => demoClient.from('app_config').update({ value: '{}' }).eq('key', 'client_package_guide'), error => error.code === 'guide_dedicated_route_required');
  assert.equal((await read()).data.revision, 1);
  deactivateDemoMode();
});
