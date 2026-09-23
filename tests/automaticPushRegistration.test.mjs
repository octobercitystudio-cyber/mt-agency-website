import test from 'node:test';
import assert from 'node:assert/strict';
import { startAutomaticPushRegistration } from '../src/lib/autoPushRegistration.js';
const settle = () => new Promise(resolve => setImmediate(resolve));
function setup(permission = 'granted', overrides = {}) {
  const listeners = new Map(), docListeners = new Map(), calls = [], errors = [];
  const environment = { Notification: { permission }, document: { visibilityState: 'visible', addEventListener: (n,f) => docListeners.set(n,f), removeEventListener: n => docListeners.delete(n) }, addEventListener: (n,f) => listeners.set(n,f), removeEventListener: n => listeners.delete(n) };
  const stop = startAutomaticPushRegistration({ environment, loadConfiguration: async () => ({enabled:true,schema_ready:true}), register: async (config, ask) => {calls.push(ask); environment.Notification.permission='granted';}, onError: e => errors.push(e), ...overrides });
  return { environment, stop, calls, errors, emit: (type, data = {}) => listeners.get(type)?.(data), listeners, docListeners };
}
test('permitted owner/client device registers on entry without pressing any button', async () => {
  const h=setup(); await settle(); assert.deepEqual(h.calls,[false]); h.emit('click',{isTrusted:true}); await settle(); assert.equal(h.calls.length,1); h.stop();
});
test('first entry asks system once and refusal is never retried by interaction or resume',async()=>{
  let calls=0; const h=setup('default',{register:async()=>{calls++;h.environment.Notification.permission='denied';throw new Error('push_permission_denied');}});
  await settle(); h.emit('click',{isTrusted:true}); h.emit('focus'); h.emit('online'); await settle(); assert.equal(calls,1); h.stop();
});
test('browser requiring activation retries once on ordinary trusted interaction',async()=>{
  let calls=0; const h=setup('default',{register:async()=>{calls++; if(calls===1)throw new Error('push_permission_required');h.environment.Notification.permission='granted';}});
  await settle(); h.emit('click',{isTrusted:false}); await settle(); assert.equal(calls,1);
  h.emit('click',{isTrusted:true}); await settle(); assert.equal(calls,2); h.stop();
});
test('denied permission never requests permission or registers',async()=>{const h=setup('denied');await settle();h.emit('focus');await settle();assert.deepEqual(h.calls,[]);h.stop();});
test('network recovery retries registration and simultaneous resume events are deduplicated',async()=>{
  let calls=0, finish;const h=setup('granted',{register:async()=>{calls++;if(calls===1)throw new Error('offline');await new Promise(resolve=>{finish=resolve});}});
  await settle();h.emit('online');h.emit('focus');await settle();assert.equal(calls,2);finish();await settle();h.stop();
});
test('logout/account switch disposes a pending config request before device ownership can change',async()=>{
  let finish;const h=setup('granted',{loadConfiguration:()=>new Promise(resolve=>{finish=resolve})});h.stop();finish({enabled:true,schema_ready:true});await settle();assert.deepEqual(h.calls,[]);assert.equal(h.listeners.size,0);assert.equal(h.docListeners.size,0);
});
test('unconfigured server does not request OS permission',async()=>{const h=setup('default',{loadConfiguration:async()=>({enabled:false})});await settle();assert.deepEqual(h.calls,[]);h.stop();});
