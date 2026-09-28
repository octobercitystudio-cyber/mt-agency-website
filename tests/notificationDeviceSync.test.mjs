import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileDeviceNotifications } from '../src/lib/notificationDeviceSync.js';

function phone() {
  const closed = [], badges = [], calls = [];
  const notification = (tag, url) => ({ tag, data: { url }, close() { closed.push(tag); } });
  const staff = [notification('mt-notification-1', '/erp/requests'), notification('mt-notification-2', '/erp/requests'), notification('mt-notification-test', '/erp/')];
  const root = [notification('mt-notification-3', '/erp/bookings'), notification('mt-notification-4', '/dashboard'), notification('another-app', '/erp/')];
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    serviceWorker: { getRegistrations: async () => [
      { scope: 'https://example.test/erp/', getNotifications: async () => [...staff] },
      { scope: 'https://example.test/', getNotifications: async () => [...root] },
    ] }, setAppBadge: async count => badges.push(count), clearAppBadge: async () => badges.push(0),
  } });
  return { closed, badges, calls, staff, root, notification, restore: () => previous ? Object.defineProperty(globalThis, 'navigator', previous) : delete globalThis.navigator };
}

test('reading clears committed phone notifications and old staff scope, preserving unread/customer alerts', async () => {
  const h = phone();
  try {
    await reconcileDeviceNotifications({ request: async (path, options) => {
      assert.equal(path, '/app-notifications/device-state');
      assert.deepEqual(JSON.parse(options.body).ids, [1, 2, 3]);
      return { data: { unread_ids: [2], unread_count: 1 } };
    } }, { staff: true, clearTests: true });
    assert.deepEqual(h.closed, ['mt-notification-1', 'mt-notification-test', 'mt-notification-3']);
    assert.deepEqual(h.badges, [1]);
  } finally { h.restore(); }
});
test('all read clears the badge and diagnostic alerts without clearing notifications arriving mid-request', async () => {
  const h = phone();
  try {
    await reconcileDeviceNotifications({ request: async () => {
      h.staff.push(h.notification('mt-notification-99', '/erp/requests'));
      return { data: { unread_ids: [], unread_count: 1 } };
    } }, { staff: true, clearTests: true });
    assert.ok(!h.closed.includes('mt-notification-99'));
    assert.deepEqual(h.badges, [1]);
    await reconcileDeviceNotifications({ request: async () => ({ data: { unread_ids: [], unread_count: 0 } }) }, { staff: true, clearTests: true });
    assert.equal(h.badges.at(-1), 0);
  } finally { h.restore(); }
});
test('offline, invalid responses and a superseded account never clear notifications', async () => {
  const h = phone();
  try {
    for (const result of [{ error: { message: 'offline' } }, { data: {} }]) {
      await reconcileDeviceNotifications({ request: async () => result }, { staff: true, clearTests: true });
    }
    let current = true;
    await reconcileDeviceNotifications({ request: async () => { current = false; return { data: { unread_ids: [], unread_count: 0 } }; } }, { staff: true, isCurrent: () => current });
    assert.deepEqual(h.closed, []); assert.deepEqual(h.badges, []);
  } finally { h.restore(); }
});
test('background reconciliation does not erase a test while the user is checking its arrival', async () => {
  const h = phone();
  try {
    await reconcileDeviceNotifications({ request: async () => ({ data: { unread_ids: [1, 2, 3], unread_count: 3 } }) }, { staff: true });
    assert.deepEqual(h.closed, []);
  } finally { h.restore(); }
});
test('customer reconciliation cannot cancel current or legacy staff notifications', async () => {
  const h = phone();
  try {
    await reconcileDeviceNotifications({ request: async (path, options) => {
      assert.deepEqual(JSON.parse(options.body).ids, [4]);
      return { data: { unread_ids: [], unread_count: 0 } };
    } }, { staff: false, clearTests: true });
    assert.deepEqual(h.closed, ['mt-notification-4']); assert.deepEqual(h.badges, [0]);
  } finally { h.restore(); }
});
