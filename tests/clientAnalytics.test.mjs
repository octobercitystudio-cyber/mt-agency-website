import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaPixelTracker } from '../src/lib/metaPixel.js';
import { CLIENT_ACTIONS, successfulClientAction, createClientRequestRecorder } from '../src/lib/clientAnalytics.js';
const post = { method: 'POST', body: '{"phone":"secret","password":"secret"}' };
const success = { data: { id: 42, client_name: 'private' }, error: null };
const cases = [
 ['/registration/complete', 'registration'], ['/client/studio-booking-requests', 'package_request'],
 ['/bookings/request', 'booking_request'], ['/reschedule-requests', 'reschedule'],
 ['/bookings/9/cancel-request', 'cancel_request'], ['/client/appointment-requests/booking/9/withdraw', 'withdraw'],
 ['/payment-proofs', 'payment_proof'], ['/client/promotions/9/subscribe', 'promotion_subscribe'],
 ['/offers/9/accept', 'offer_accept'], ['/app-notifications/9/read', 'notification_read'],
 ['/app-notifications/read-all', 'notifications_read'], ['/app-notifications/9/dismiss', 'notification_dismiss'],
];
test('only successful allowlisted business operations produce events', () => {
 for (const [path, action] of cases) {
  assert.equal(successfulClientAction(path, post, success), action);
  for (const result of [undefined, {data:null}, {error:{message:'failed'}}, {...success,error:{message:'failed'}}, {data:{idempotent:true}}, {data:{already_subscribed:true}}]) assert.equal(successfulClientAction(path, post, result),null);
  assert.equal(successfulClientAction(path,{method:'GET'},success),null);
 }
 for (const path of ['/payments','/auth/reset-password','/admin','/client/studio-availability']) assert.equal(successfulClientAction(path,post,success),null);
 assert.equal(successfulClientAction('/bookings/9/alternative-decision',{...post,body:'{"action":"accept","notes":"private"}'},success),'alternative_accept');
 assert.equal(successfulClientAction('/bookings/9/alternative-decision',{...post,body:'{"action":"reject"}'},success),'alternative_reject');
 assert.equal(successfulClientAction('/bookings/9/alternative-decision',post,success),null);
});
test('replayed creation responses do not duplicate conversion events; new requests still count', () => {
 const events=[]; const record=createClientRequestRecorder(action=>events.push(action));
 record('/client/studio-booking-requests',post,success);record('/client/studio-booking-requests',post,success);
 record('/client/studio-booking-requests',post,{data:{id:43}});
 record('/payment-proofs',post,success);
 assert.deepEqual(events,['package_request','package_request','payment_proof']);
});
test('client events contain only static event names; no purchase for requests or proofs', () => {
 const win={};const tracker=createMetaPixelTracker(win,{querySelector:()=>true});
 for (const action of Object.keys(CLIENT_ACTIONS)) tracker.action('/dashboard','client',action);
 const events=win.fbq.queue.filter(item=>['track','trackCustom'].includes(item[0]));
 assert.equal(events.length,Object.keys(CLIENT_ACTIONS).length);
 assert.ok(events.every(item=>item.length===2));
 assert.ok(events.every(item=>item[1]!=='Purchase'));
 tracker.action('/dashboard','client','password=secret');
 assert.equal(win.fbq.queue.filter(item=>item[0]==='trackCustom'||item[0]==='track').length,events.length);
});
test('staff, unknown routes and unauthenticated dashboard cannot emit client events', () => {
 const win={};const tracker=createMetaPixelTracker(win,{querySelector:()=>{throw Error('must not load');}});
 for (const [path,role] of [['/dashboard',null],['/dashboard','owner'],['/p-e2f8474bcda6b5ea/login','owner'],['/login','owner'],['/reset-password',null]]) {
  for(const action of Object.keys(CLIENT_ACTIONS))tracker.action(path,role,action);
  tracker.interaction(path,role,'finance','button');tracker.screen(path,role,'finance');
 }
 assert.equal(win.fbq,undefined);
});
test('screen views are deduplicated and unknown URL query values and field types never leak', () => {
 const win={};const tracker=createMetaPixelTracker(win,{querySelector:()=>true});
 tracker.screen('/dashboard','client','finance');tracker.screen('/dashboard','client','finance');
 tracker.screen('/dashboard','client','phone=private');
 tracker.interaction('/dashboard','client','private name','button');
 tracker.interaction('/register',null,'private','password');
 tracker.action('/register',null,'registration');tracker.action('/login',null,'login');
 const events=win.fbq.queue;
 assert.deepEqual(events.filter(x=>x[1]==='ClientScreenViewed').map(x=>x[2]),[{screen:'finance'},{screen:'home'}]);
 assert.deepEqual(events.find(x=>x[1]==='ClientInteraction')[2],{screen:'home',control:'button'});
 assert.equal(events.filter(x=>x[1]==='CompleteRegistration').length,1);
 assert.equal(events.filter(x=>x[1]==='ClientLogin').length,1);
 assert.ok(!JSON.stringify(events).includes('private'));
});
