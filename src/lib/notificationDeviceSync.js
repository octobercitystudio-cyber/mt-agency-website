import { isStaffPushPage } from './pushScope.js';
import { syncAppBadge } from './pushNotifications.js';

const notificationId = notification => {
  const match = /^mt-notification-([1-9]\d*)$/.exec(notification.tag || '');
  return match && Number.isSafeInteger(Number(match[1])) ? Number(match[1]) : null;
};
const isTest = notification => ['mt-notification-test', 'mt-notification-local-test'].includes(notification.tag);

export async function reconcileDeviceNotifications(dataClient, { staff = isStaffPushPage(), clearTests = false, isCurrent = () => true } = {}) {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker?.getRegistrations) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const captured = [];
    for (const registration of registrations) {
      const scope = new URL(registration.scope).pathname;
      if (scope !== '/' && !(staff && scope === '/erp/')) continue;
      const notifications = await registration.getNotifications();
      for (const notification of notifications) {
        if (!notificationId(notification) && !isTest(notification)) continue;
        if (scope === '/') {
          // Older staff releases used the root worker. Preserve customer alerts
          // when cleaning those old staff notifications on a shared phone.
          const url = notification.data?.url;
          if (staff && !url) continue;
          if (url && isStaffPushPage(new URL(url, registration.scope).pathname) !== staff) continue;
        }
        captured.push(notification);
      }
    }
    if (!isCurrent()) return;
    const ids = [...new Set(captured.map(notificationId).filter(Boolean))];
    const unread = new Set(); let count;
    for (let offset = 0; offset < Math.max(1, ids.length); offset += 100) {
      const { data, error } = await dataClient.request('/app-notifications/device-state', {
        method: 'POST', body: JSON.stringify({ ids: ids.slice(offset, offset + 100) }),
      });
      if (error || !Array.isArray(data?.unread_ids) || !Number.isFinite(Number(data?.unread_count)) || !isCurrent()) return;
      data.unread_ids.forEach(id => unread.add(Number(id)));
      count = Number(data.unread_count);
    }
    if (!isCurrent()) return;
    // Close only the captured objects: notifications arriving during the request
    // were never part of this snapshot and must survive, including read-all.
    for (const notification of captured) {
      const id = notificationId(notification);
      if ((id && !unread.has(id)) || (clearTests && isTest(notification))) notification.close();
    }
    await syncAppBadge(count);
  } catch { /* An offline/unsupported phone must retain its notifications. Retry on refresh. */ }
}
