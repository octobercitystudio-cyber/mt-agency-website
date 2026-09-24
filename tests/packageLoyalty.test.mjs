import assert from 'node:assert/strict';
import test from 'node:test';
import { monthlyPackageLoyalty } from '../src/lib/packageLoyalty.js';
import { templateToPackageDraft, packageDraftIsDirty, resetPackageDraftToTemplate } from '../src/lib/clientPackageDraft.js';
import { syncDemoPackageLoyalty } from '../src/lib/packageLoyaltyDemo.js';

test('monthly defaults use category, allow override and reset when template changes', () => {
  for (const category of ['monthly', 'الباقات الشهرية', 'باقة شهرية']) assert.equal(monthlyPackageLoyalty({ category, billing_unit: 'hour' }), true);
  for (const category of ['hourly', 'daily', 'الباقات اليومية']) assert.equal(monthlyPackageLoyalty({ category, billing_unit: 'hour', validity_days: 30 }), false);
  const service = { id: 1, name: 'Monthly', category: 'monthly', billing_unit: 'hour', total_hours: 20, price: 3400 };
  const draft = templateToPackageDraft(service, { clientId: 1 });
  assert.equal(draft.loyalty_enabled, true); assert.equal(packageDraftIsDirty({ ...draft, loyalty_enabled: false }, service), true);
  assert.equal(resetPackageDraftToTemplate({ ...draft, loyalty_enabled: false }, service).loyalty_enabled, true);
  assert.equal(resetPackageDraftToTemplate(draft, { ...service, category: 'hourly' }).loyalty_enabled, false);
});

test('approved allocations earn once and disabled payment refund preserves previous earnings', () => {
  const db = { clients: [{id:1,points:15}], client_packages:[{id:1,client_id:1,paid_amount:3400}], app_config:[{key:'points_egp_spent',value:10},{key:'points_earned',value:1}], payments:[],payment_allocations:[] };
  assert.equal(syncDemoPackageLoyalty(db,1,true,true).client_points,355);
  assert.equal(syncDemoPackageLoyalty(db,1,true,true).points_added,0);
  syncDemoPackageLoyalty(db,1,false); db.payments.push({id:1,status:'approved'}); db.payment_allocations.push({payment_id:1,client_package_id:1,amount:100});db.client_packages[0].paid_amount=3500;
  assert.equal(syncDemoPackageLoyalty(db,1).points_added,0);
  db.payments[0].status='voided';db.client_packages[0].paid_amount=3400;
  assert.equal(syncDemoPackageLoyalty(db,1).client_points,355);
  syncDemoPackageLoyalty(db,1,true);db.payments.push({id:2,status:'approved'});db.payment_allocations.push({payment_id:2,client_package_id:1,amount:100});db.client_packages[0].paid_amount=3500;
  assert.equal(syncDemoPackageLoyalty(db,1).points_added,10);
});

test('sale route preserves manual toggle, replay, rollback and owner-only retroactive activation', async () => {
  const storage = new Map(); globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};globalThis.window={dispatchEvent(){}};globalThis.CustomEvent=class {};
  const { activateDemoMode, resetDemoDatabase, demoClient } = await import('../src/lib/demoDataClient.js');resetDemoDatabase();activateDemoMode('owner');
  const service=(await demoClient.from('services').select('*')).data.find(row=>row.id===101);
  const draft={...templateToPackageDraft(service,{clientId:1}),loyalty_enabled:false,paid_amount:100,idempotency_key:'loyalty-sale-1'};
  const create=await demoClient.request('/client-packages',{method:'POST',body:JSON.stringify(draft)});assert.equal(create.error,null);
  const id=create.data.id;
  const replay=await demoClient.request('/client-packages',{method:'POST',body:JSON.stringify(draft)});assert.equal(replay.data.idempotent,true);
  const mismatch=await demoClient.request('/client-packages',{method:'POST',body:JSON.stringify({...draft,loyalty_enabled:true})});assert.equal(mismatch.error.code,'idempotency_payload_mismatch');
  const initial=await demoClient.request(`/client-packages/${id}/loyalty`);assert.equal(initial.data.enabled,false);assert.equal(initial.data.awarded_points,0);
  const body=JSON.stringify({enabled:true,include_paid:true});const enabled=await demoClient.request(`/client-packages/${id}/loyalty`,{method:'POST',body});assert.equal(enabled.error,null);assert.ok(enabled.data.points_added>0);
  const retry=await demoClient.request(`/client-packages/${id}/loyalty`,{method:'POST',body});assert.equal(retry.data.points_added,0);
  const before=storage.get('mt_agency_erp_demo_v12');await demoClient.request('/client-packages',{method:'POST',body:JSON.stringify({...draft,idempotency_key:'loyalty-fail-1',loyalty_enabled:true,__test_fail_at:'audit'})});assert.equal(storage.get('mt_agency_erp_demo_v12'),before);
  activateDemoMode('operations');const forbidden=await demoClient.request(`/client-packages/${id}/loyalty`,{method:'POST',body});assert.equal(forbidden.error.code,'forbidden');
});
