import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readyPushRegistration, subscribeStaffPush, pushTokenStorageKey } from '../src/lib/pushScope.js';
import { registerPushNotifications, unregisterPushNotifications, testPushDelivery } from '../src/lib/pushNotifications.js';

test('staff registration, test and logout preserve the customer subscription and stored token', async () => {
  const saved = Object.fromEntries(['navigator', 'location', 'localStorage', 'Notification'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const store = new Map([['mt:push:fcm-token', 'customer-token']]);
  const calls = [], registrations = [];
  const key = new Uint8Array([4, 1, 2, 3]);
  let subscriptions = 0, removals = 0;
  const subscription = { options: { applicationServerKey: key.buffer }, toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/wp/staff-device', keys: { p256dh: 'public', auth: 'auth' } }), unsubscribe: async () => { removals++; } };
  const root = { client: true };
  const staff = { active: {}, pushManager: { getSubscription: async () => subscription, subscribe: async () => { subscriptions++; return subscription; } } };
  try {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'Android', serviceWorker: { ready: Promise.resolve(root), register: async (...args) => { registrations.push(args); return staff; } } } });
    Object.defineProperty(globalThis, 'location', { configurable: true, value: { pathname: '/erp' } });
    Object.defineProperty(globalThis, 'Notification', { configurable: true, value: { permission: 'granted' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: k => store.get(k), setItem: (k, v) => store.set(k, v), removeItem: k => store.delete(k) } });
    const api = { request: async (path, options) => { calls.push({ path, ...options, body: JSON.parse(options.body) }); return { data: { sent: true } }; } };
    assert.equal(await readyPushRegistration(false), root);
    const config = { enabled: true, schema_ready: true, transport: 'webpush', vapid_public_key: Buffer.from(key).toString('base64url') };
    const result = await registerPushNotifications(api, config);
    assert.ok(result.token.startsWith('webpush:'));
    assert.deepEqual(registrations[0], ['/sw.js?audience=staff', { scope: '/erp/', updateViaCache: 'none' }]);
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

for (const staff of [true, false]) test(`${staff ? 'staff' : 'customer'} worker refreshes and opens only its own audience`, async () => {
  const handlers = {}, messages = [], navigations = [], shown = [], opened = [];
  const origin = 'https://multitaskagency.com';
  let windows = ['/dashboard', '/erp/bookings'].map(path => ({ url: origin + path, postMessage: data => messages.push({ path, data }), navigate: async url => navigations.push({ path, url }), focus: async () => {} }));
  const self = { location: { origin, href: origin + '/sw.js' + (staff ? '?audience=staff' : '') }, addEventListener: (name, fn) => { handlers[name] = fn; }, registration: { showNotification: async (...args) => shown.push(args) }, clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) } };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), { self, URL });
  let work;
  handlers.push({ data: { json: () => ({ data: { title: 'Update', unread_count: '2' } }) }, waitUntil: p => { work = p; } });
  await work;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].path, staff ? '/erp/bookings' : '/dashboard');
  assert.equal(shown[0][1].silent, false);
  const click = async () => { handlers.notificationclick({ notification: { close() {}, data: shown[0][1].data }, waitUntil: p => { work = p; } }); await work; };
  await click();
  assert.equal(navigations.length, 1);
  assert.equal(navigations[0].path, staff ? '/erp/bookings' : '/dashboard');
  windows = windows.filter(window => window.url !== origin + navigations[0].path);
  await click();
  assert.equal(opened.length, 1);
  assert.equal(new URL(opened[0]).pathname, staff ? '/erp/' : '/login');
});
