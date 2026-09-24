import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyCompanyPickupSchedule, validateCompanyPickupSchedule } from '../src/lib/pickupSchedule.js';
const window = (weekday=6,start_time='14:00',end_time='18:00') => ({ weekday, start_time, end_time });
const payload = { expected_revision: 0, enabled: true, note: 'بعد تأكيد جاهزية الفيديوهات', windows: [window()] };

test('weekly schedule validates exact weekdays, times and overlaps without an expiry', () => {
  assert.deepEqual(validateCompanyPickupSchedule(payload), { enabled: true, timezone: 'Africa/Cairo', note: payload.note, windows: payload.windows });
  assert.equal(validateCompanyPickupSchedule({ ...payload, windows: [window(5,'12:00','14:00'),window(5,'14:00','16:00')] }).windows.length,2);
  for (const [values,code] of [
    [{ enabled: 1 },'invalid_pickup_schedule'], [{ note: 'أ'.repeat(501) },'invalid_pickup_schedule'],
    [{ windows: [] },'invalid_pickup_windows'], [{ windows: Array(22).fill(window()) },'invalid_pickup_windows'],
    [{ windows: [window(7)] },'invalid_pickup_weekday'], [{ windows: [window('6')] },'invalid_pickup_weekday'],
    [{ windows: [window(6,'18:00','12:00')] },'invalid_pickup_window'], [{ windows: [window(6,'12:00','24:00')] },'invalid_pickup_window'],
    [{ windows: [window(),window(6,'17:00','19:00')] },'pickup_schedule_overlap'],
  ]) assert.throws(()=>validateCompanyPickupSchedule({...payload,...values}),error=>error.code===code);
});

test('shared demo schedule persists for every client, isolates companies and rejects stale saves', async () => {
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  globalThis.window={dispatchEvent(){}};globalThis.CustomEvent=class {constructor(type,init){this.type=type;this.detail=init?.detail;}};
  const { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } = await import('../src/lib/demoDataClient.js');
  await resetDemoDatabase();activateDemoMode('owner',1,1);
  const endpoint='/post-production/pickup-schedule';
  const put=body=>demoClient.request(endpoint,{method:'PUT',body:JSON.stringify(body)});
  assert.deepEqual((await demoClient.request(endpoint)).data,emptyCompanyPickupSchedule());
  const saved=await put(payload);assert.equal(saved.error,null);assert.equal(saved.data.revision,1);
  assert.equal((await put(payload)).data.idempotent,true);
  assert.equal((await put({...payload,note:'تعديل قديم'})).error.code,'pickup_revision_conflict');
  for(const clientId of [1,2]){
    activateDemoMode('client',clientId,1);
    assert.deepEqual((await demoClient.request(endpoint)).data.windows,payload.windows);
    assert.deepEqual((await demoClient.request('/client/post-production')).data.pickup_schedule.windows,payload.windows);
    assert.ok((await demoClient.request('/sync?cursor=0')).data.topics.includes('post_production'));
    assert.equal((await put({...payload,expected_revision:1})).error.code,'forbidden');
  }
  activateDemoMode('owner',1,2);assert.deepEqual((await demoClient.request(endpoint)).data,emptyCompanyPickupSchedule());
  activateDemoMode('owner',1,1);
  const disabled=await put({...payload,enabled:false,expected_revision:1});assert.equal(disabled.data.revision,2);assert.deepEqual(disabled.data.windows,payload.windows);
  deactivateDemoMode();activateDemoMode('owner',1,1);assert.equal((await demoClient.request(endpoint)).data.enabled,false);
  assert.equal((await demoClient.request(endpoint)).data.revision,2);
  const database=JSON.parse(storage.get('mt_agency_erp_demo_v12'));
  assert.equal(database.app_config.filter(row=>row.key==='post_production_pickup_schedule').length,1);
  assert.equal(database.change_events.filter(row=>row.entity_type==='pickup_schedule').length,2);
  deactivateDemoMode();
});
