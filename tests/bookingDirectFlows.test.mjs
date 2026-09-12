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

test('positive unlinked sessions reject every completion path that does not assign an eligible existing hour package',async()=>{
  let db=database();const source=db.bookings.find(row=>row.id===301);db.bookings.push({...source,id:993,client_package_id:null,service_id:null,service:'جلسة مباشرة غير مسندة',status:'in_progress',requested_quantity:2});db.booking_sessions.push({id:993,booking_id:993,client_id:1,status:'active',billing_unit:'hour',settlement_version:1,started_at:`${source.date} 12:00:00`,booking_held_quantity:0});db.client_packages.push({id:994,client_id:1,service_id:101,name:'باقة الإسناد الوحيدة',billing_unit:'hour',purchased_quantity:4,purchased_minutes:240,held_quantity:0,held_minutes:0,consumed_quantity:0,consumed_minutes:0,status:'active',starts_at:null,expires_at:null,validity_days_snapshot:90,validity_mode_snapshot:'rolling',version:1,total_price:0,paid_amount:0});writeDatabase(db);
  const preview=await demoClient.request('/bookings/993/session/settlement-preview',{method:'POST',body:JSON.stringify({actual_minutes:60})});assert.equal(preview.error,null);
  const forbidden=[
    {mode:'waive',internal_reason:'استثناء غير مسموح'},
    {mode:'custom_invoice',description:'فاتورة بديلة',amount:'100'},
    {mode:'custom_project',name:'مشروع بديل',description:'خدمة بديلة',amount:'100'},
    {mode:'package_overage',hourly_rate:'100'},
    {mode:'new_package',service_id:101,name:'باقة جديدة',purchased_minutes:60,validity_days:30,total_price:'0',initial_paid:'0',payment_method:'cash'},
  ];
  for(const [index,settlement] of forbidden.entries()){
    const result=await demoClient.request('/bookings/993/session/complete',{method:'POST',body:JSON.stringify({actual_minutes:60,idempotency_key:`reject-unassigned-${index}`,expected_session_version:preview.data.session_version,preview_hash:preview.data.preview_hash,settlement})});
    assert.equal(result.data,null);assert.equal(result.error?.code,'unassigned_package_required');
  }
  db=database();assert.equal(db.bookings.find(row=>row.id===993).client_package_id,null);assert.equal(db.bookings.find(row=>row.id===993).status,'in_progress');assert.equal(db.session_settlements.some(row=>Number(row.booking_id)===993),false);assert.equal(db.package_usage_ledger.some(row=>Number(row.booking_id)===993),false);
});

test('production and stop-dialog contracts enforce package-only allocation for positive unlinked sessions',async()=>{
  const [php,api,dialog,calendar,actions]=await Promise.all([
    readFile(new URL('../api/session_settlement.php',import.meta.url),'utf8'),
    readFile(new URL('../api/index.php',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPStopSessionDialog.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPBookings.jsx',import.meta.url),'utf8'),
    readFile(new URL('../src/erp/ERPBookingDayActionsDialog.jsx',import.meta.url),'utf8'),
  ]);
  assert.match(php,/\$requiresPackageAssignment&&\$mode!==['"]existing_package['"]/);assert.match(php,/unassigned_package_required/);
  const directRoute=api.slice(api.indexOf("if ($path==='/studio-sessions/start-direct'"),api.indexOf("if (preg_match('#^/bookings/(\\d+)/session/settlement-preview$#'"));const hashExpression=directRoute.slice(directRoute.indexOf('$requestHash='),directRoute.indexOf(";$requestKey='direct-session:"));assert.match(hashExpression,/client_id.*resource_id.*date.*end_time.*title.*note/);assert.doesNotMatch(hashExpression,/start_time/);
  const branchStart=dialog.indexOf(': isUnassigned ? <>',dialog.indexOf('isOperations ?'));
  const branchEnd=dialog.indexOf(': <>',branchStart+1);const packageOnlyBranch=dialog.slice(branchStart,branchEnd);
  assert.ok(branchStart>0&&branchEnd>branchStart);assert.match(packageOnlyBranch,/data-unassigned-package-only/);assert.match(packageOnlyBranch,/preview\.eligible_packages\.map/);assert.doesNotMatch(packageOnlyBranch,/new_package|package_overage|custom_invoice|custom_project|waive|SettlementChoice/);assert.match(dialog,/وقت غير مسند/);
  assert.match(calendar,/\.erp-bookings-calendar \.fc \{ min-width: 0; \}/);assert.match(calendar,/\.erp-bookings-calendar \.fc-view-harness \{ min-width: 760px; \}/);assert.match(calendar,/-webkit-line-clamp: 2/);
  assert.match(actions,/وابدأ المؤقت الآن بدون باقة/);assert.doesNotMatch(actions,/المؤق الآن/);assert.match(actions,/aria-label="إغلاق"/);
});
