import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { activateDemoMode, deactivateDemoMode, demoClient, resetDemoDatabase } from '../src/lib/demoDataClient.js';

const storage=new Map();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),clear:()=>storage.clear()}});Object.defineProperty(globalThis,'window',{configurable:true,value:new EventTarget()});
const database=()=>JSON.parse([...storage.values()][0]);const writeDatabase=value=>storage.set([...storage.keys()][0],JSON.stringify(value));
test.beforeEach(()=>{storage.clear();activateDemoMode('owner');resetDemoDatabase()});test.afterEach(()=>deactivateDemoMode());

test('temporary booking keeps its visible title and converts its existing slots into one package booking',async()=>{
  const day=new Date();day.setDate(day.getDate()+120);while(day.getDay()===5)day.setDate(day.getDate()+1);const date=day.toLocaleDateString('en-CA');let db=database();const resourceId=Number(db.resources.find(row=>Number(row.is_active??1)===1).id);db.client_packages.push({id:990,client_id:1,service_id:101,name:'باقة تحويل',billing_unit:'hour',purchased_quantity:4,purchased_minutes:240,held_quantity:0,held_minutes:0,consumed_quantity:0,consumed_minutes:0,status:'active',starts_at:null,expires_at:null,validity_days_snapshot:90,validity_mode_snapshot:'rolling',version:1,total_price:0,paid_amount:0});writeDatabase(db);
  const created=await demoClient.request('/booking-blocks',{method:'POST',body:JSON.stringify({date,resource_id:resourceId,start_time:'12:00',end_time:'13:30',title:'معاينة منتجات العيد',note:'إحضار الخلفية البيضاء',idempotency_key:'visible-block-001'})});assert.equal(created.error,null);assert.equal(created.data.items[0].title,'معاينة منتجات العيد');
  const block=created.data.items[0];const converted=await demoClient.request(`/booking-blocks/${block.id}/convert`,{method:'POST',body:JSON.stringify({client_id:1,client_package_id:990,idempotency_key:'convert-block-001'})});assert.equal(converted.error,null);assert.equal(converted.data.held_minutes,90);db=database();assert.equal(db.booking_blocks.find(row=>row.id===block.id).status,'cancelled');assert.equal(db.booking_slots.filter(row=>Number(row.booking_id)===Number(converted.data.booking.id)).length,6);assert.equal(db.package_usage_ledger.filter(row=>Number(row.booking_id)===Number(converted.data.booking.id)&&row.movement_type==='hold').length,1);assert.equal(db.client_packages.find(row=>row.id===990).held_minutes,90);
  const replay=await demoClient.request(`/booking-blocks/${block.id}/convert`,{method:'POST',body:JSON.stringify({client_id:1,client_package_id:990,idempotency_key:'convert-block-001'})});assert.equal(replay.error,null);assert.equal(replay.data.idempotent,true);assert.equal(database().package_usage_ledger.filter(row=>Number(row.booking_id)===Number(converted.data.booking.id)).length,1);
});

test('an unlinked active session previews all minutes as unassigned and links the booking when allocated',async()=>{
  let db=database();const source=db.bookings.find(row=>row.id===301);const booking={...source,id:991,client_package_id:null,service_id:null,service:'جلسة مباشرة',status:'in_progress',requested_quantity:2};db.bookings.push(booking);db.booking_sessions.push({id:991,booking_id:991,client_id:1,status:'active',billing_unit:'hour',settlement_version:1,started_at:`${booking.date} 12:00:00`,booking_held_quantity:0});db.client_packages.push({id:992,client_id:1,service_id:101,name:'باقة إسناد',billing_unit:'hour',purchased_quantity:3,purchased_minutes:180,held_quantity:0,held_minutes:0,consumed_quantity:0,consumed_minutes:0,status:'active',starts_at:null,expires_at:null,validity_days_snapshot:90,validity_mode_snapshot:'rolling',version:1,total_price:0,paid_amount:0});writeDatabase(db);
  const preview=await demoClient.request('/bookings/991/session/settlement-preview',{method:'POST',body:JSON.stringify({actual_minutes:75})});assert.equal(preview.error,null);assert.equal(preview.data.covered_minutes,0);assert.equal(preview.data.unassigned_minutes,75);assert.equal(preview.data.requires_package_assignment,true);assert.ok(preview.data.eligible_packages.some(row=>row.id===992));
  const done=await demoClient.request('/bookings/991/session/complete',{method:'POST',body:JSON.stringify({actual_minutes:75,idempotency_key:'assign-direct-001',expected_session_version:preview.data.session_version,preview_hash:preview.data.preview_hash,settlement:{mode:'existing_package',target_package_id:992,target_package_version:1}})});assert.equal(done.error,null);db=database();assert.equal(db.bookings.find(row=>row.id===991).client_package_id,992);assert.equal(db.client_packages.find(row=>row.id===992).consumed_minutes,75);assert.equal(db.package_usage_ledger.filter(row=>Number(row.booking_id)===991&&row.movement_type==='consume').length,1);assert.equal(done.data.whatsapp_summary.package_id,992);
});

test('unlinked sessions reject unsupported waiver, project and package overage modes',async()=>{
  let db=database();const source=db.bookings.find(row=>row.id===301);db.bookings.push({...source,id:993,client_package_id:null,service_id:null,service:'جلسة مباشرة غير مسندة',status:'in_progress',requested_quantity:2});db.booking_sessions.push({id:993,booking_id:993,client_id:1,status:'active',billing_unit:'hour',settlement_version:1,started_at:`${source.date} 12:00:00`,booking_held_quantity:0});db.client_packages.push({id:994,client_id:1,service_id:101,name:'باقة الإسناد الوحيدة',billing_unit:'hour',purchased_quantity:4,purchased_minutes:240,held_quantity:0,held_minutes:0,consumed_quantity:0,consumed_minutes:0,status:'active',starts_at:null,expires_at:null,validity_days_snapshot:90,validity_mode_snapshot:'rolling',version:1,total_price:0,paid_amount:0});writeDatabase(db);
  const preview=await demoClient.request('/bookings/993/session/settlement-preview',{method:'POST',body:JSON.stringify({actual_minutes:60})});assert.equal(preview.error,null);
  const forbidden=[
    {mode:'waive',internal_reason:'استثناء غير مسموح'},
    {mode:'custom_project',name:'مشروع بديل',description:'خدمة بديلة',amount:'100'},
    {mode:'package_overage',hourly_rate:'100'},
  ];
  for(const [index,settlement] of forbidden.entries()){
    const result=await demoClient.request('/bookings/993/session/complete',{method:'POST',body:JSON.stringify({actual_minutes:60,idempotency_key:`reject-unassigned-${index}`,expected_session_version:preview.data.session_version,preview_hash:preview.data.preview_hash,settlement})});
    assert.equal(result.data,null);assert.equal(result.error?.code,'unassigned_package_required');
  }
  db=database();assert.equal(db.bookings.find(row=>row.id===993).client_package_id,null);assert.equal(db.bookings.find(row=>row.id===993).status,'in_progress');assert.equal(db.session_settlements.some(row=>Number(row.booking_id)===993),false);assert.equal(db.package_usage_ledger.some(row=>Number(row.booking_id)===993),false);
});

test('unlinked sessions can finish with a new package or an individual invoice exactly once', async t => {
  for (const mode of ['new_package', 'custom_invoice']) await t.test(mode, async () => {
    resetDemoDatabase();
    const db = database(); const source = db.bookings.find(row => row.id === 301);
    db.bookings.push({ ...source, id: 995, client_package_id: null, service_id: null, service: 'جلسة مباشرة', status: 'in_progress' });
    db.booking_sessions.push({ id: 995, booking_id: 995, client_id: 1, status: 'active', billing_unit: 'hour', settlement_version: 1, started_at: `${source.date} 12:00:00`, booking_held_quantity: 0 });
    writeDatabase(db);
    const preview = await demoClient.request('/bookings/995/session/settlement-preview', { method: 'POST', body: JSON.stringify({ actual_minutes: 165 }) });
    assert.equal(preview.error, null);
    const settlement = mode === 'new_package' ? { mode, service_id: 101, name: 'باقة الجلسة المباشرة', purchased_minutes: 240, validity_days: 30, total_price: '1000.00', initial_paid: '0.00', payment_method: 'cash' } : { mode, description: 'جلسة فردية', hourly_rate: '100.00', amount: '' };
    const body = { actual_minutes: 165, idempotency_key: `direct-supported-${mode}`, expected_session_version: preview.data.session_version, preview_hash: preview.data.preview_hash, settlement };
    const result = await demoClient.request('/bookings/995/session/complete', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(result.error, null);
    const after = database(); assert.equal(after.bookings.find(row => row.id === 995).status, 'completed');
    if (mode === 'new_package') {
      const pkg = after.client_packages.find(row => row.id === result.data.target_package_id);
      assert.equal(pkg.consumed_minutes, 165); assert.equal(pkg.purchased_minutes - pkg.consumed_minutes, 75);
      assert.equal(after.bookings.find(row => row.id === 995).client_package_id, pkg.id);
    } else {
      assert.equal(Number(after.invoices.find(row => row.id === result.data.invoice_id).total), 275);
      assert.equal(after.package_usage_ledger.some(row => Number(row.booking_id) === 995), false);
    }
    const replay = await demoClient.request('/bookings/995/session/complete', { method: 'POST', body: JSON.stringify(body) });
    assert.equal(replay.error, null); assert.equal(database().session_settlements.filter(row => Number(row.booking_id) === 995).length, 1);
  });
});

test('production and stop dialog allow existing package, new package and individual invoice settlement',async()=>{
  const [php,api,dialog,calendar,actions,view]=await Promise.all([
    readFile(new URL('../api/session_settlement.php',import.meta.url),'utf8'),
    readFile(new URL('../api/index.php',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPStopSessionDialog.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPBookings.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPBookingDayActionsDialog.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPBookingWideView.jsx',import.meta.url),'utf8'),
  ]);
  assert.ok(php.includes("$requiresPackageAssignment&&!in_array($mode,['existing_package','new_package','custom_invoice'],true)"));
  const directRoute=api.slice(api.indexOf("if ($path==='/studio-sessions/start-direct'"),api.indexOf("if (preg_match('#^/bookings/(\\d+)/session/settlement-preview$#'"));const hashExpression=directRoute.slice(directRoute.indexOf('$requestHash='),directRoute.indexOf(";$requestKey='direct-session:"));assert.match(hashExpression,/client_id.*resource_id.*date.*end_time.*title.*note/);assert.doesNotMatch(hashExpression,/start_time/);
  assert.doesNotMatch(dialog, /data-unassigned-package-only/); assert.match(dialog, /وقت فردي بتكلفة مخصصة/); assert.match(dialog, /value="new_package"/); assert.match(dialog, /وقت غير مسند/);
  assert.match(calendar,/<ERPBookingWideView/);assert.match(view,/className="bookings-wide-mobile-dates"/);assert.match(view,/data\.block_note/);assert.doesNotMatch(view,/-webkit-line-clamp/);
  assert.match(actions,/وابدأ المؤقت الآن بدون باقة/);assert.doesNotMatch(actions,/المؤق الآن/);assert.match(actions,/aria-label="إغلاق"/);
});
