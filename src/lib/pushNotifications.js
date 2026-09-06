const TOKEN_KEY = 'mt:push:fcm-token';
const DISMISSED_KEY = 'mt:push:prompt-dismissed-at';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const FIREBASE_APP_NAME = 'mt-agency-push';

let foregroundUnsubscribe;

const normalizedBadgeCount = value => Math.max(0, Math.min(999, Math.trunc(Number(value) || 0)));

export const syncAppBadge = async (value, { clearSystemNotifications = false } = {}) => {
  if (typeof navigator === 'undefined') return;
  const count = normalizedBadgeCount(value);
  try {
    if (count > 0 && typeof navigator.setAppBadge === 'function') await navigator.setAppBadge(count);
    else if (count === 0 && typeof navigator.clearAppBadge === 'function') await navigator.clearAppBadge();
  } catch { /* Badge support is launcher/browser dependent. */ }
  if (!clearSystemNotifications || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications();
    notifications.filter(item => String(item.tag || '').startsWith('mt-notification-')).forEach(item => item.close());
  } catch { /* Closing delegated notifications is best effort. */ }
};

export const clearSystemNotification = async notificationId => {
  if (!notificationId || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications({ tag: `mt-notification-${notificationId}` });
    notifications.forEach(item => item.close());
  } catch { /* Notification may already have been opened or dismissed. */ }
};

export const pushEnvironmentSupported = () => (
  typeof window !== 'undefined'
  && 'serviceWorker' in navigator
  && 'Notification' in window
  && 'PushManager' in window
);

export const pushPromptDismissed = () => {
  const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
  return dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
};

export const dismissPushPrompt = () => localStorage.setItem(DISMISSED_KEY, String(Date.now()));
export const resetPushPromptDismissal = () => localStorage.removeItem(DISMISSED_KEY);

export const loadPushConfiguration = async dataClient => {
  if (!pushEnvironmentSupported()) return { enabled: false, reason: 'unsupported' };
  const { data, error } = await dataClient.request('/push/config', { method: 'GET' });
  if (error) throw error;
  return data || { enabled: false };
};

const firebaseMessaging = async configuration => {
  const [{ initializeApp, getApp, getApps }, messagingModule] = await Promise.all([
    import('firebase/app'),
    import('firebase/messaging'),
  ]);
  if (!(await messagingModule.isSupported())) throw new Error('push_unsupported');
  const app = getApps().some(item => item.name === FIREBASE_APP_NAME)
    ? getApp(FIREBASE_APP_NAME)
    : initializeApp(configuration.firebase, FIREBASE_APP_NAME);
  return { messaging: messagingModule.getMessaging(app), ...messagingModule };
};

const foregroundNotification = async payload => {
  const data = payload?.data || {};
  const unreadCount = normalizedBadgeCount(data.unread_count || 1);
  const syncTopics = String(data.sync_topics || 'notifications').split(',').map(topic => topic.trim()).filter(Boolean);
  window.dispatchEvent(new CustomEvent('mtPushChange', { detail: { topics: [...new Set(syncTopics)], source: 'firebase' } }));
  await syncAppBadge(unreadCount);
  if (Notification.permission !== 'granted') return;
  const registration = await navigator.serviceWorker.ready;
  const notification = payload?.notification || {};
  await registration.showNotification(notification.title || data.title || 'MT Agency', {
    body: notification.body || data.body || 'لديك تحديث جديد في حسابك.',
    icon: '/app-icon.svg',
    badge: '/app-icon-monochrome.svg',
    dir: 'rtl',
    lang: 'ar',
    tag: data.notification_id ? `mt-notification-${data.notification_id}` : `mt-notification-${Date.now()}`,
    renotify: true,
    silent: false,
    vibrate: [220, 100, 220],
    data: { url: data.url || '/login?source=android-notification' },
  });
};

export const registerPushNotifications = async (dataClient, configuration, requestPermission = true) => {
  if (!configuration?.enabled || !configuration?.schema_ready) throw new Error('push_not_configured');
  let permission = Notification.permission;
  if (permission === 'default' && requestPermission) permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    const error = new Error(permission === 'denied' ? 'push_permission_denied' : 'push_permission_required');
    error.code = permission;
    throw error;
  }
  const registration = await navigator.serviceWorker.ready;
  const { messaging, getToken, onMessage } = await firebaseMessaging(configuration);
  const token = await getToken(messaging, {
    vapidKey: configuration.vapid_public_key,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('push_token_missing');
  const { error } = await dataClient.request('/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      token,
      platform: /Android/i.test(navigator.userAgent) ? 'web-android' : 'web',
      device_label: /Android/i.test(navigator.userAgent) ? 'تطبيق Android' : 'متصفح الويب',
    }),
  });
  if (error) throw error;
  localStorage.setItem(TOKEN_KEY, token);
  resetPushPromptDismissal();
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = onMessage(messaging, foregroundNotification);
  return { token, permission };
};

export const unregisterPushNotifications = async dataClient => {
  const token = localStorage.getItem(TOKEN_KEY);
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = undefined;
  if (!token) return { unregistered: true, changed: false };
  const { error } = await dataClient.request('/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
  if (error) throw error;
  localStorage.removeItem(TOKEN_KEY);
  return { unregistered: true, changed: true };
};

export const hasStoredPushToken = () => Boolean(localStorage.getItem(TOKEN_KEY));
