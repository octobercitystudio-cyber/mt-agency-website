import { staffPath } from '../src/lib/staffRoutes.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readyPushRegistration, subscribeStaffPush, pushTokenStorageKey } from '../src/lib/pushScope.js';
import { registerPushNotifications, unregisterPushNotifications, testPushDelivery, syncAppBadge } from '../src/lib/pushNotifications.js';

test('staff registration, test and logout preserve the customer subscription and stored token', async () => {
  const saved = Object.fromEntries(['navigator', 'location', 'localStorage', 'Notification'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const store = new Map([['mt:push:fcm-token', 'customer-token']]);
  const calls = [], registrations = [];
  const key = new Uint8Array([4, 1, 2, 3]);
  let subscriptions = 0, removals = 0;
  const subscription = { options: { applicationServerKey: key.buffer }, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/wp/staff-device', keys: { p256dh: 'public', auth: 'auth' } }), unsubscribe: async () => { removals++; } };
  const root = { client: true, active: {} };
  const staff = { active: {}, pushManager: { getSubscription: async () => subscription, subscribe: async () => { subscriptions++; return subscription; } } };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Android', serviceWorker: { ready: Promise.resolve(staff), register: async (...args) => { registrations.push(args); return args[1].scope === '/' ? root : staff; } } } });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/erp' } });
    Object.defineProperty(globalThis, 'Notification', { configurable: true, value: { permission: 'granted' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) } });
    const api = { request: async (path, options) => { calls.push({ path, ...options, body: JSON.parse(options.body) }); return { data: { sent: true } }; } };
    assert.equal(await readyPushRegistration(false), root);
    const config = { enabled: true, schema_ready: true, transport: 'webpush', vapid_public_key: Buffer.from(key).toString('base64url') };
    const result = await registerPushNotifications(api, config);
    assert.ok(result.token.startsWith('webpush:'));
    assert.deepEqual(registrations[0], ['/sw.js', { scope: '/', updateViaCache: 'none' }]);
    assert.deepEqual(registrations[1], ['/sw.js?audience=staff', { scope: '/erp/', updateViaCache: 'none' }]);
    assert.equal(calls[0].body.previous_token, 'customer-token');
    assert.equal(store.get(pushTokenStorageKey(false)), 'customer-token');
    assert.equal(store.get(pushTokenStorageKey(true)), result.token);
    assert.equal(subscriptions, 0); assert.equal(removals, 0);
    await testPushDelivery(api);
    assert.equal(calls[1].body.token, result.token);
    await subscribeStaffPush(staff, config.vapid_public_key, true);
    assert.equal(subscriptions, 1); assert.equal(removals, 1);
    await unregisterPushNotifications(api);
    assert.equal(calls[2].body.token, result.token);
    assert.equal(store.has(pushTokenStorageKey(true)), false);
    assert.equal(store.get(pushTokenStorageKey(false)), 'customer-token');
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});

test('expired staff subscription renews on ordinary registration without touching customer registration', async () => {
  const key = new Uint8Array([4, 1, 2, 3]); let removed = 0, created = 0;
  const old = { expirationTime: Date.now() - 1, options: { applicationServerKey: key.buffer }, unsubscribe: async () => { removed++; } };
  const fresh = { toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/wp/new-staff', keys: { auth: 'a', p256dh: 'b' } }) };
  const registration = { pushManager: { getSubscription: async () => old, subscribe: async options => { assert.equal(options.userVisibleOnly, true); created++; return fresh; } } };
  const token = await subscribeStaffPush(registration, Buffer.from(key).toString('base64url'));
  assert.equal(removed, 1); assert.equal(created, 1); assert.ok(token.includes('new-staff'));
});

for (const staff of [true, false]) test(`${staff ? 'staff' : 'customer'} worker refreshes and opens only its own audience`, async () => {
  const handlers = {}, messages = [], navigations = [], shown = [], opened = [], badges = [];
  const origin = 'https://multitaskagency.com';
  let windows = ['/dashboard', '/erp/bookings'].map(path => ({ url: origin + path, postMessage: data => messages.push({ path, data }), navigate: async url => navigations.push({ path, url }), focus: async () => {} }));
  const self = { navigator: { setAppBadge: async value => badges.push(value) }, location: { origin, href: origin + '/sw.js' + (staff ? '?audience=staff' : '') }, addEventListener: (name, fn) => { handlers[name] = fn; }, registration: { showNotification: async (...args) => shown.push(args) }, clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) } };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL });
  let work;
  handlers.push({ data: { json: () => ({ data: { title: 'Update', unread_count: '2' } }) }, waitUntil: p => { work = p; } });
  await work;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].data.audience, staff ? 'staff' : 'client');
  assert.deepEqual(badges, [], 'worker cannot badge the other app via shared origin');
  assert.equal(messages[0].path, staff ? '/erp/bookings' : '/dashboard');
  assert.equal(shown[0][1].silent, false);
  const click = async () => { handlers.notificationclick({ notification: { close() {}, data: shown[0][1].data }, waitUntil: p => { work = p; } }); await work; };
  await click();
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0].path, staff ? '/erp/bookings' : '/dashboard');
  windows = windows.filter(window => window.url !== origin + navigations[0].path);
  await click();
  assert.equal(opened.length, 1);
  assert.equal(new URL(opened[0]).pathname, staff ? staffPath('/') : '/login');
  for (const data of [{ audience: staff ? 'client' : 'staff' }, { url: staff ? '/dashboard' : staffPath('/requests') }]) {
    handlers.push({ data: { json: () => ({ data }) }, waitUntil: () => assert.fail('wrong audience must not display') });
  }
  assert.equal(shown.length, 1);
  // Even a stale notification click must not navigate into the other app.
  handlers.notificationclick({ notification: { close() {}, data: { url: staff ? '/dashboard' : staffPath('/requests') } }, waitUntil: p => { work = p; } });
  await work;
  assert.equal(new URL(opened.at(-1)).pathname, staff ? staffPath('/') : '/login');
  const closed = [];
  self.registration.getNotifications = async () => ['/dashboard', staffPath('/requests')].map(url => ({ data: { url }, close: () => closed.push(url) }));
  self.clients.claim = async () => {};
  handlers.activate({ waitUntil: p => { work = p; } }); await work;
  assert.deepEqual(closed, [staff ? '/dashboard' : staffPath('/requests')]);
});

test('Android read sync closes only this app notifications without changing the other app badge', async () => {
  const saved = Object.fromEntries(['navigator', 'location'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const registered = [], closed = [], badges = [];
  try {
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: staffPath('/requests') } });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
      userAgent: 'Android', setAppBadge: value => badges.push(value), clearAppBadge: () => badges.push(0),
      serviceWorker: { register: async (_url, { scope }) => { registered.push(scope); return { active: {}, getNotifications: async () => [{ tag: 'mt-notification-1', close: () => closed.push(scope) }] }; } },
    } });
    await syncAppBadge(4);
    await syncAppBadge(0, { clearSystemNotifications: true });
    assert.deepEqual(badges, []); assert.deepEqual(registered, ['/erp/']); assert.deepEqual(closed, ['/erp/']);
    globalThis.location.pathname = '/dashboard';
    await syncAppBadge(2); await syncAppBadge(0, { clearSystemNotifications: true });
    assert.deepEqual(badges, []); assert.deepEqual(registered, ['/erp/', '/']);
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
});
