import assert from 'node:assert/strict';
import test from 'node:test';
import { PAYMENT_METHODS, normalizePaymentMethod, paymentMethodLabel } from '../src/lib/paymentMethods.js';
import { templateToPackageDraft } from '../src/lib/clientPackageDraft.js';
const setup = async () => {
  const storage = new Map(); globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key,value) => storage.set(key,String(value)), removeItem: key => storage.delete(key) };
  globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class {};
  const demo = await import('../src/lib/demoDataClient.js'); demo.resetDemoDatabase(); demo.activateDemoMode('owner');
  return { ...demo, db: () => JSON.parse(storage.get('mt_agency_erp_demo_v12')) };
};
test('payment choices normalize existing labels without reclassifying historical bank records', () => {
  assert.deepEqual(Object.values(PAYMENT_METHODS), ['كاش','انستاباي','فودافون كاش']);
  for (const [alias,method] of [['نقدي','cash'],['إنستاباي','instapay'],['فودافون كاش','vodafone_cash']]) assert.equal(normalizePaymentMethod(alias),method);
  for (const old of ['bank_transfer','تحويل بنكي','بطاقة','شيك','constructor','toString']) assert.equal(normalizePaymentMethod(old),'');
  assert.equal(paymentMethodLabel('bank_transfer'),'تحويل بنكي');
});
test('every package opening payment reaches the same wallet in payment and finance records', async () => {
  const {db,demoClient,deactivateDemoMode}=await setup();
  for (const method of Object.keys(PAYMENT_METHODS)) {
    const service=db().services.find(s=>s.id===101);
    const draft={...templateToPackageDraft(service,{clientId:1}),paid_amount:'100.25',payment_method:method,bookings:[],idempotency_key:`unified-opening-${method}-001`};
    const response=await demoClient.request('/client-packages',{method:'POST',body:JSON.stringify(draft)});assert.equal(response.error,null);
    const after=db();const allocation=after.payment_allocations.find(r=>r.client_package_id===response.data.id);assert.ok(allocation);
    const payment=after.payments.find(r=>r.id===allocation.payment_id);assert.equal(payment.method,method);assert.equal(Number(payment.amount),100.25);
    const finance=after.finance.find(r=>r.source_type==='payment'&&r.source_id===payment.id);assert.equal(finance.method,method);assert.equal(Number(finance.amount),100.25);
    const retry=await demoClient.request('/client-packages',{method:'POST',body:JSON.stringify(draft)});assert.equal(retry.data.id,response.data.id);
  }
  const before=db();const rejected=await demoClient.request('/finance/manual',{method:'POST',body:JSON.stringify({entry_kind:'income',amount:10,method:'bank_transfer',detail:'اختبار',date:'2026-09-21'})});assert.equal(rejected.error?.code,'invalid_payment_method');assert.deepEqual(db(),before);deactivateDemoMode();
});
test('Vodafone receipt approval remains Vodafone and correcting legacy bank payment preserves its original method', async () => {
  const {db,demoClient,activateDemoMode,deactivateDemoMode}=await setup();activateDemoMode('client');
  const proof=await demoClient.request('/payment-proofs',{method:'POST',body:JSON.stringify({client_package_id:201,amount:100,payment_method:'vodafone_cash'})});assert.equal(proof.error,null);
  activateDemoMode('owner');const approved=await demoClient.request(`/payment-proofs/${proof.data.id}/decision`,{method:'POST',body:JSON.stringify({action:'approve'})});assert.equal(approved.error,null);
  const receipt=db().payment_proofs.find(r=>r.id===proof.data.id);const payment=db().payments.find(r=>r.id===receipt.payment_id);assert.equal(payment.method,'vodafone_cash');assert.equal(db().finance.find(r=>r.source_type==='payment'&&r.source_id===payment.id).method,'vodafone_cash');
  const correction=await demoClient.request('/payments/603/correct',{method:'POST',body:JSON.stringify({amount:4100,reason:'تصحيح وسيلة الدفع',method:'instapay'})});assert.equal(correction.error,null);assert.equal(db().payments.find(r=>r.id===603).method,'bank_transfer');assert.equal(db().payments.find(r=>r.corrected_from_id===603).method,'instapay');deactivateDemoMode();
});
