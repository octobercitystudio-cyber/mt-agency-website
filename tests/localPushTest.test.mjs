import assert from 'node:assert/strict';
import test from 'node:test';
import { testLocalPushNotification } from '../src/lib/pushNotifications.js';

test('phone-only diagnostic requests an audible system notification without server access', async () => {
 const saved = Object.fromEntries(['window','navigator','Notification','location'].map(key => [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const shown = [];
 try {
  Object.defineProperty(globalThis,'window',{configurable:true,value:{Notification:{},PushManager:{}}});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{serviceWorker:{register:async()=>({active:{},showNotification:async(...args)=>shown.push(args)})}}});
  Object.defineProperty(globalThis,'Notification',{configurable:true,value:{permission:'granted'}});
  Object.defineProperty(globalThis,'location',{configurable:true,value:{pathname:'/erp'}});
  assert.equal((await testLocalPushNotification()).requested,true);
  assert.equal(shown.length,1);assert.equal(shown[0][1].silent,false);assert.equal(shown[0][1].data.url,'/erp/');
  assert.equal(shown[0][1].tag,'mt-notification-local-test');
  globalThis.Notification.permission='denied';
  await assert.rejects(testLocalPushNotification(),/push_permission_denied/);assert.equal(shown.length,1);
 } finally { for (const [key, descriptor] of Object.entries(saved)) { if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]; } }
});
