import { CLIENT_APP_PACKAGE_ID, CLIENT_APP_VERSION } from '../data/clientApp.js';

export const CLIENT_APP_ENTRY_KEY = 'mta:client-app-entry';
export const CLIENT_APP_UPDATE_SNOOZE_KEY = `mta:client-app-update:${CLIENT_APP_VERSION}:later`;
export const CLIENT_APP_UPDATE_SNOOZE_MS = 24 * 60 * 60 * 1000;

// Presentation hints only; never used for authentication or permissions.
export function clientAppEntry({ search = '', referrer = '', userAgent = '', remembered = false }) {
  const source = new URLSearchParams(search).get('source');
  if (/^android-staff-/.test(source || '') || /^android-app:\/\/com\.multitaskagency\.staff(?:\/|$)/.test(referrer)) return false;
  return /^android-app:\/\/com\.multitaskagency\.app(?:\/|$)/.test(referrer)
    || (/Android/i.test(userAgent) && ['android-app', 'android-shortcut', 'android-notification'].includes(source))
    || remembered;
}

export function clientAppVersionStatus(version, latest = CLIENT_APP_VERSION) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '') || !/^\d+\.\d+\.\d+$/.test(latest)) return 'unknown';
  const installedParts = version.split('.').map(Number);
  const latestParts = latest.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (installedParts[i] < latestParts[i]) return 'outdated';
    if (installedParts[i] > latestParts[i]) return 'current';
  }
  return 'current';
}

export async function installedClientVersion(navigatorObject, timeoutMs = 2000) {
  if (typeof navigatorObject?.getInstalledRelatedApps !== 'function') return null;
  let timer;
  try {
    const apps = await Promise.race([
      navigatorObject.getInstalledRelatedApps(),
      new Promise(resolve => { timer = setTimeout(() => resolve([]), timeoutMs); }),
    ]);
    return Array.isArray(apps) ? apps.find(app => app.platform === 'play' && app.id === CLIENT_APP_PACKAGE_ID)?.version || null : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function updateSnoozed(value, now = Date.now()) {
  const until = Number(value);
  return Number.isFinite(until) && until > now && until <= now + CLIENT_APP_UPDATE_SNOOZE_MS;
}
