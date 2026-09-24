import test from 'node:test';
import assert from 'node:assert/strict';
import { recurringBlocks, firstSeriesOverlap } from '../src/lib/bookingBlockRecurrence.js';

test('daily rules preserve concrete exceptions, boundaries and tenant isolation', () => {
 const rule={organization_id:1,resource_id:1,series_key:'a',starts_on:'2030-01-01',repeat_until:null,status:'active',start_time:'14:00',end_time:'16:00'};
 const db={booking_block_series:[rule],booking_blocks:[{organization_id:1,series_key:'a',block_date:'2040-01-01',status:'cancelled'}]};
 assert.deepEqual(recurringBlocks(db,1,'2040-01-01','2040-01-03').map(row=>row.block_date),['2040-01-02','2040-01-03']);
 assert.deepEqual(recurringBlocks(db,2,'2040-01-01','2040-01-03'),[]);
 assert.equal(firstSeriesOverlap(db,1,1,'2040-01-01',null,'14:00','15:00'),'2040-01-02');
 assert.equal(firstSeriesOverlap(db,1,1,'2040-01-01','2040-01-01','14:00','15:00'),null);
 assert.equal(firstSeriesOverlap(db,1,1,'2040-01-01',null,'16:00','17:00'),null);
 rule.repeat_until='2040-01-02';assert.equal(recurringBlocks(db,1,'2040-01-01','2040-01-03').length,1);
});

test('open recurrence is private in client calendar, manageable far ahead, and cancellation persists', async()=>{
 const store=new Map();globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};globalThis.window={dispatchEvent(){}};globalThis.CustomEvent=class {};
 const {activateDemoMode,deactivateDemoMode,demoClient,resetDemoDatabase}=await import('../src/lib/demoDataClient.js');
 resetDemoDatabase();activateDemoMode('owner');
 const payload={date:'2030-01-01',start_time:'14:00',end_time:'16:00',resource_id:1,repeat_daily:true,repeat_end_mode:'never',title:'Secret meeting',note:'Private reason',idempotency_key:'series-demo-open-0001'};
 const saved=await demoClient.request('/booking-blocks',{method:'POST',body:JSON.stringify(payload)});assert.equal(saved.error,null);assert.equal(saved.data.count,null);
 const listed=await demoClient.request('/booking-blocks?from=2035-02-01&to=2035-02-03');assert.equal(listed.error,null);assert.equal(listed.data.length,3);
 const repeated=await demoClient.request('/booking-blocks?from=2035-02-01&to=2035-02-03');assert.deepEqual(repeated.data.map(row=>row.id),listed.data.map(row=>row.id));
 activateDemoMode('client');
 const calendar=await demoClient.request('/client/booking-availability?client_package_id=201&duration_minutes=60&start_date=2035-02-01&days=3');assert.equal(calendar.error,null);assert.deepEqual(calendar.data.days[0].busy_intervals,[{start_time:'14:00',end_time:'16:00'}]);assert.doesNotMatch(JSON.stringify(calendar.data),/Secret meeting|Private reason/);
 const sync=await demoClient.request('/sync?cursor=0');assert.equal(sync.error,null);assert.ok(sync.data.events.some(row=>row.topic==='availability'&&row.entity_type==='calendar_availability'&&row.entity_id==null));assert.ok(sync.data.events.every(row=>row.entity_type!=='booking_blocks'));
 activateDemoMode('owner');
 const removed=await demoClient.request(`/booking-blocks/${listed.data[0].id}?scope=single`,{method:'DELETE'});assert.equal(removed.error,null);
 const after=await demoClient.request('/booking-blocks?from=2035-02-01&to=2035-02-03');assert.deepEqual(after.data.map(row=>row.block_date),['2035-02-02','2035-02-03']);
 await demoClient.request(`/booking-blocks/${listed.data[1].id}?scope=series`,{method:'DELETE'});
 assert.deepEqual((await demoClient.request('/booking-blocks?from=2040-02-01&to=2040-02-03')).data,[]);
 assert.equal((await demoClient.request('/booking-blocks?from=2034-02-01&to=2034-02-01')).data.length,1);
 const target=(await demoClient.request('/booking-blocks?from=2034-02-01&to=2034-02-01')).data[0];
 const conversion=await demoClient.request(`/booking-blocks/${target.id}/convert`,{method:'POST',body:JSON.stringify({client_id:1,package_mode:'new_package',new_package:{service_id:101,name:'باقة اختبار',billing_unit:'hour',quantity:4,validity_days:30,payment_due_quantity:2,deposit_percent_snapshot:50,overage_price_snapshot:'200.00',total_price:'1000.00',paid_amount:'0.00',payment_method:'cash'},idempotency_key:'demo-series-conversion-0001'})});
 assert.equal(conversion.error,null);assert.equal(conversion.data.held_minutes,120);
 assert.deepEqual((await demoClient.request('/booking-blocks?from=2034-02-01&to=2034-02-01')).data,[]);
 deactivateDemoMode();
});
