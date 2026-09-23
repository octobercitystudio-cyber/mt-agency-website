import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

test('background push requests audible notification and refreshes open owner clients',async()=>{
 const handlers={}, shown=[], messages=[];let work;
 const self={location:{origin:'https://example.test'},navigator:{setAppBadge:async()=>{}},addEventListener:(name,fn)=>handlers[name]=fn,registration:{showNotification:async(...args)=>shown.push(args)},clients:{matchAll:async()=>[{postMessage:m=>messages.push(m)}]}};
 vm.runInNewContext(readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),{self,URL});
 handlers.push({data:{json:()=>({data:{notification_id:'91',title:'حساب جديد',body:'اختبار',url:'/erp/clients',unread_count:'3',sync_topics:'notifications,clients'}})},waitUntil:p=>{work=p}});await work;
 assert.equal(shown.length,1);assert.equal(shown[0][0],'حساب جديد');assert.equal(shown[0][1].silent,false);assert.equal(shown[0][1].renotify,true);assert.equal(shown[0][1].tag,'mt-notification-91');assert.equal(shown[0][1].data.url,'/erp/clients');assert.equal(messages[0].unread_count,3);assert.deepEqual(Array.from(messages[0].topics),['notifications','clients']);
});

test('closed app and locked-screen path displays without any window; test does not change badge', async () => {
 const handlers = {}, shown = [], badges = []; let work;
 const self = { location: { origin: 'https://multitaskagency.com' }, navigator: { setAppBadge: async n => badges.push(n) }, addEventListener: (name, fn) => handlers[name] = fn, registration: { showNotification: async (...args) => shown.push(args) }, clients: { matchAll: async () => [] } };
 vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL });
 const send = async data => { handlers.push({ data: { json: () => ({ data }) }, waitUntil: p => { work = p; } }); await work; };
 await send({ title: 'موعدك تأكد', notification_id: '92', unread_count: '7', url: '/dashboard?tab=schedule' });
 assert.equal(shown.length, 1); assert.equal(shown[0][1].silent, false); assert.equal(shown[0][1].data.url, '/dashboard?tab=schedule'); assert.deepEqual(badges, [7]);
 await send({ title: 'تجربة', is_test: '1', notification_id: '0', unread_count: '1' });
 assert.equal(shown.length, 2); assert.equal(shown[1][1].tag, 'mt-notification-test'); assert.deepEqual(badges, [7]);
});
