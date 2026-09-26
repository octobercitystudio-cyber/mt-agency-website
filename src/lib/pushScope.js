export const isStaffPushPage = (pathname = globalThis.location?.pathname || '') => /^\/(erp|adminmt|admin)(\/|$)/.test(pathname);
export const pushTokenStorageKey = (staff = isStaffPushPage()) => staff ? 'mt:push:staff-webpush-token' : 'mt:push:fcm-token';

export const readyPushRegistration = async (staff = isStaffPushPage()) => {
  if (!staff) return navigator.serviceWorker.ready;
  const registration = await navigator.serviceWorker.register('/sw.js?audience=staff', { scope: '/erp/', updateViaCache: 'none' });
  if (registration.active) return registration;
  await new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) { reject(new Error('push_worker_unavailable')); return; }
    const finish = () => {
      if (worker.state === 'activated') { clearTimeout(timer); worker.removeEventListener('statechange', finish); resolve(); }
      else if (worker.state === 'redundant') { clearTimeout(timer); worker.removeEventListener('statechange', finish); reject(new Error('push_worker_unavailable')); }
    };
    const timer = setTimeout(() => { worker.removeEventListener('statechange', finish); reject(new Error('push_worker_unavailable')); }, 15000);
    worker.addEventListener('statechange', finish); finish();
  });
  return registration;
};

export const subscribeStaffPush = async (registration, publicKey, renew = false) => {
  const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - base64.length % 4) % 4)), character => character.charCodeAt(0));
  let subscription = await registration.pushManager.getSubscription();
  if (subscription && (renew || !subscription.options?.applicationServerKey || !equalBytes(new Uint8Array(subscription.options.applicationServerKey), bytes))) {
    await subscription.unsubscribe(); subscription = null;
  }
  subscription ||= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  return `webpush:${JSON.stringify(subscription.toJSON())}`;
};
const equalBytes = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
