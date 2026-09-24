import assert from 'node:assert/strict';
import test from 'node:test';
import { studioPurchaseSelection, studioDayShares, validateStudioBookings } from '../src/lib/studioBookingPolicy.js';
const hours={id:101,kind:'hourly',total_hours:1,price:1000.03,deposit_amount:500.02,validity_days:1,package_validity_mode:'rolling'};
const days=['2027-02-06','2027-05-01','2027-08-07','2027-11-06'].map(date=>({date,start_time:'12:00',end_time:'13:00',duration_minutes:60,resource_id:1}));
test('hourly purchase can allocate four hours over separate months with conserved cents',()=>{
 const selected=studioPurchaseSelection(hours,4);assert.equal(Number(selected.price),4000.12);assert.equal(Number(selected.deposit_amount),2000.06);assert.equal(validateStudioBookings(selected,days),'');assert.match(validateStudioBookings(selected,days.slice(0,3)),/كل الساعات/);assert.equal(validateStudioBookings(selected,days.slice(0,1),true,false),'');const shares=studioDayShares(selected,days);assert.equal(shares.reduce((n,s)=>n+Math.round(Number(s.paid)*100),0),200006);for(const count of [0,1.5,301,'bad'])assert.equal(studioPurchaseSelection(hours,count),null);
});
test('daily purchase requires one complete continuous session on a single date',()=>{
 const daily={...hours,kind:'daily',total_hours:4,package_validity_mode:'shooting_day'};
 assert.match(validateStudioBookings(daily,[days[0]]),/كاملة/);assert.match(validateStudioBookings(daily,days),/يوم واحد/);assert.equal(validateStudioBookings(daily,[{...days[0],end_time:'16:00',duration_minutes:240}]),'');
});
test('demo hourly request approves one payment with four independent day packages',async()=>{
 const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};globalThis.window={dispatchEvent(){}};globalThis.CustomEvent=class {};
 const {resetDemoDatabase,activateDemoMode,demoClient}=await import('../src/lib/demoDataClient.js');resetDemoDatabase();activateDemoMode('client');const key='mt_agency_erp_demo_v12';let db=JSON.parse(storage.get(key));db.client_packages.forEach(p=>p.status='expired');db.services.push({...db.services.find(s=>s.id===101),id:901,category:'تصوير بالساعة',total_hours:1,price:1000.03,payment_due_hours:0,validity_days:1});storage.set(key,JSON.stringify(db));
 const service=(await demoClient.request('/registration/catalog')).data.services.find(s=>s.id===901);
 const form=new FormData();form.append('payload',JSON.stringify({service_id:901,selected_hours:4,service_terms_fingerprint:service.terms_fingerprint,bookings:days,terms_accepted:true,terms_version:'2026-09-23',idempotency_key:'hourly-demo-day-allocation'}));form.append('proof',new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+iBu8AAAAASUVORK5CYII=','base64')],'receipt.png',{type:'image/png'}));
 const req=await demoClient.request('/client/studio-booking-requests',{method:'POST',body:form});assert.equal(req.error,null);activateDemoMode('owner');const post=body=>demoClient.request(`/studio-booking-requests/${req.data.id}/decision`,{method:'POST',body:JSON.stringify(body)});const before=db.payments.length;assert.equal((await post({stage:'package',action:'approve',payment_received_confirmed:true})).error,null);assert.equal((await post({stage:'package',action:'approve',payment_received_confirmed:true})).error,null);
 db=JSON.parse(storage.get(key));assert.equal(db.payments.length,before+1);const map=db.studio_booking_requests[0].service_snapshot.day_package_ids;assert.equal(Object.keys(map).length,4);for(const [i,id] of Object.entries(map)){const p=db.client_packages.find(p=>p.id===id);assert.equal(p.starts_at,days[Number(i)-1].date);assert.equal(p.expires_at,p.starts_at);assert.equal(p.purchased_minutes,60);assert.equal((await post({stage:'booking',action:'approve',booking_request_id:Number(i)})).error,null);}
});
