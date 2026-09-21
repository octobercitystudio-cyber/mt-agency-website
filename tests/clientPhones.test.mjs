import assert from 'node:assert/strict';
import test from 'node:test';
import { clientAdditionalPhones, clientPhoneFields, normalizeClientPhone } from '../src/lib/clientPhones.js';

test('client contacts restore legacy phones and JSON lists without duplicates', () => {
  assert.deepEqual(clientAdditionalPhones({ phone1: '01012345678', phone2: '01123456789' }), ['01123456789']);
  assert.deepEqual(clientAdditionalPhones({ phone1: '01012345678', phone2: '01123456789', additional_phones: null }), ['01123456789']);
  assert.deepEqual(clientAdditionalPhones({ phone1: '01012345678', additional_phones: '["01123456789","01234567890","01123456789"]' }), ['01123456789','01234567890']);
  assert.equal(normalizeClientPhone('+20 10 1234 5678'), '01012345678');
  assert.equal(normalizeClientPhone('٠١١٢٣٤٥٦٧٨٩'), '01123456789');
  assert.deepEqual(clientPhoneFields({ phone1: '01012345678', additional_phones: ['', ' +20 10 1234 5678 ', '٠١١٢٣٤٥٦٧٨٩', '01123456789', '01234567890'] }), { phone1: '01012345678', phone2: '01123456789', additional_phones: ['01123456789','01234567890'] });
  assert.throws(() => clientPhoneFields({ phone1: '01012345678', additional_phones: ['123'] }));
  assert.throws(() => clientPhoneFields({ phone1: '123', additional_phones: [] }));
});

test('multiple phone numbers survive create, edit, remove and reload without erasing legacy client details', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key,String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} };
  globalThis.CustomEvent = class { constructor(type) { this.type=type; } };
  const { demoClient, resetDemoDatabase, activateDemoMode, deactivateDemoMode } = await import('../src/lib/demoDataClient.js');
  resetDemoDatabase(); activateDemoMode('owner');
  const data = { name:'عميل بأرقام متعددة', phone1:'01070000009', additional_phones:['01170000009','01270000009'], job:'مدير', company_name:'شركة اختبار', color:'#123456', email:'retained@example.com', notes:'بيانات قديمة', whatsapp_opt_in:0 };
  const created = await demoClient.request('/clients',{ method:'POST',body:JSON.stringify(data) });
  assert.equal(created.error,null);
  const get = async () => (await demoClient.from('clients').select('*').eq('id',created.data.id).single()).data;
  let stored = await get(); assert.deepEqual(stored.additional_phones,data.additional_phones); assert.equal(stored.phone2,'01170000009');
  await demoClient.from('clients').update({ name:data.name, phone1:data.phone1, additional_phones:['01270000009','01570000009'], job:'مصور', company_name:'شركة جديدة' }).eq('id',stored.id);
  stored = await get(); assert.deepEqual(stored.additional_phones,['01270000009','01570000009']); assert.equal(stored.phone2,'01270000009');
  assert.equal(stored.email,data.email); assert.equal(stored.notes,data.notes); assert.equal(stored.whatsapp_opt_in,0); assert.equal(stored.color,'#123456');
  const before = storage.get('mt_agency_erp_demo_v12');
  await assert.rejects(demoClient.from('clients').update({ additional_phones:['123'] }).eq('id',stored.id).execute());
  assert.equal(storage.get('mt_agency_erp_demo_v12'),before);
  await demoClient.from('clients').update({ additional_phones:[] }).eq('id',stored.id);
  stored=await get(); assert.deepEqual(stored.additional_phones,[]); assert.equal(stored.phone2,null); assert.equal(stored.phone1,data.phone1);
  deactivateDemoMode();
});
